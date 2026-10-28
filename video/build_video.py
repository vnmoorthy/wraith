"""Cut the WRAITH product video from your camera takes and the product screen recordings.

    python video/build_video.py                 # uses video/takes/01.mov … 10.mov if present
    python video/build_video.py --draft         # placeholder voice (macOS `say`) + text cards where takes are missing

Takes: record each line of video/script.json (or VIDEO_SCRIPT.md) as its own clip, named by segment id:
video/takes/01.mov, 02.mov, … (any of .mov .mp4 .m4v .m4a .wav). The length of each take decides how long its
segment lasts; screen segments retime their window of the product recording to fit (0.6×–1.7×), and your face
rides along as a circle in the corner. Face segments use your take full frame.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W, H, FPS = 1920, 1080, 30


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def has_video(path: Path) -> bool:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=codec_type",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout
    return "video" in out


def html_png(html: str, out: Path, transparent: bool = True) -> None:
    src = out.with_suffix(".html")
    src.write_text(html)
    args = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=4000",
            f"--screenshot={out}", f"--window-size={W},{H}"]
    if transparent:
        args.append("--default-background-color=00000000")
    subprocess.run([*args, f"file://{src}"], check=True, capture_output=True)


FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600'
         '&family=Geist:wght@400;500&display=swap" rel="stylesheet">')
GHOST = ('<svg width="{s}" height="{s}" viewBox="0 0 32 32"><path d="M8 27.5V14a8 8 0 0 1 16 0v13.5l-2.6-1.9-2.7 2-2.7-2-2.7 2-2.7-2z"'
         ' fill="none" stroke="#161615" stroke-width="1.6" stroke-linejoin="round"/><circle cx="13" cy="14.2" r="1.25" fill="#161615"/>'
         '<circle cx="19" cy="14.2" r="1.25" fill="#161615"/></svg>')


def caption_png(n: int, total: int, text: str, out: Path) -> None:
    html_png(f"""<!doctype html><html><head>{FONTS}<style>
      body{{margin:0;width:{W}px;height:{H}px;background:transparent;font-family:Geist,sans-serif}}
      .c{{position:absolute;left:72px;bottom:64px;background:#fff;border:1px solid #ebe8e2;border-radius:14px;padding:18px 26px 20px}}
      .k{{font-size:17px;color:#9a9893;letter-spacing:.02em}} .t{{font:italic 400 40px Newsreader,serif;color:#161615;margin-top:4px}}
      .t span{{background-image:linear-gradient(transparent 62%,#efe6d8 62%)}}
    </style></head><body><div class="c"><div class="k">Wraith · {n:02d} / {total:02d}</div><div class="t"><span>{text}</span></div></div></body></html>""", out)


def card_png(text: str, sub: str, out: Path) -> None:
    html_png(f"""<!doctype html><html><head>{FONTS}<style>
      body{{margin:0;width:{W}px;height:{H}px;background:#fff;font-family:Geist,sans-serif;display:flex;align-items:center}}
      .w{{margin-left:240px;max-width:1300px}} .t{{font:400 64px/1.12 Newsreader,serif;color:#161615;margin-top:40px;letter-spacing:-.01em}}
      .s{{font-size:24px;color:#9a9893;margin-top:28px}}
    </style></head><body><div class="w">{GHOST.format(s=84)}<div class="t">{text}</div><div class="s">{sub}</div></div></body></html>""",
             out, transparent=False)


def circle_mask(out: Path, d: int) -> None:
    run("-f", "lavfi", "-i", f"color=black:s={d}x{d}", "-vf",
        f"format=gray,geq=lum='if(lte(hypot(X-{d / 2},Y-{d / 2}),{d / 2 - 2}),255,0)'", "-frames:v", "1", str(out))


def find_take(sid: str) -> Path | None:
    for ext in (".mov", ".mp4", ".m4v", ".m4a", ".wav", ".aiff"):
        p = HERE / "takes" / f"{sid}{ext}"
        if p.exists():
            return p
    return None


def build(draft: bool) -> Path:
    script = json.loads((HERE / "script.json").read_text())
    segs = script["segments"]
    tmp = Path(tempfile.mkdtemp(prefix="wraith-video-"))
    mask = tmp / "mask.png"
    circle_mask(mask, 340)
    parts = []

    # intro card
    card_png("The war room that builds itself.", "Wraith · Hack with YOU, Halloween 2026", tmp / "intro.png")
    run("-loop", "1", "-t", "2.4", "-i", str(tmp / "intro.png"), "-f", "lavfi", "-t", "2.4", "-i", "anullsrc=r=48000:cl=stereo",
        "-vf", f"scale={W}:{H},fps={FPS},format=yuv420p,fade=in:0:12", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-shortest",
        str(tmp / "p00.mp4"))
    parts.append(tmp / "p00.mp4")

    for i, seg in enumerate(segs, start=1):
        sid = seg["id"]
        take = find_take(sid)
        if take is None:
            if not draft:
                raise SystemExit(f"missing take video/takes/{sid}.mov (or run with --draft)")
            take = tmp / f"say{sid}.aiff"
            subprocess.run(["say", "-v", "Samantha", "-r", "178", "-o", str(take), seg["line"]], check=True)
        d = duration(take) + 0.35
        cap = tmp / f"cap{sid}.png"
        caption_png(i, len(segs), seg["caption"], cap)
        face = has_video(take)
        out = tmp / f"p{sid}.mp4"
        if seg["kind"] == "face":
            if face:
                v_in = ["-i", str(take)]
                vf = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}[bg]"
            else:
                card_png(seg["line"], seg["caption"], tmp / f"card{sid}.png")
                v_in = ["-loop", "1", "-t", f"{d}", "-i", str(tmp / f"card{sid}.png")]
                vf = f"[0:v]scale={W}:{H},fps={FPS}[bg]"
            a_in = ["-i", str(take)]
            run(*v_in, *a_in, "-loop", "1", "-t", f"{d}", "-i", str(cap), "-filter_complex",
                f"{vf};[bg][2:v]overlay=0:0:shortest=1,format=yuv420p[v];[1:a]apad,aresample=48000[a]",
                "-map", "[v]", "-map", "[a]", "-t", f"{d}", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", str(out))
        else:
            clip = HERE / "clips" / f"{seg['clip']}.mp4"
            a, b = seg["window"]
            span = min(b, duration(clip)) - a
            speed = max(0.6, min(1.7, span / d))
            screen = f"[0:v]trim=start={a}:duration={span},setpts=(PTS-STARTPTS)/{speed:.4f},tpad=stop_mode=clone:stop_duration={d},fps={FPS},scale={W}:{H}[s]"
            inputs = ["-i", str(clip), "-i", str(take), "-loop", "1", "-t", f"{d}", "-i", str(cap)]
            graph = f"{screen};[s][2:v]overlay=0:0[sc]"
            if face:
                inputs += ["-i", str(take), "-loop", "1", "-t", f"{d}", "-i", str(mask)]
                graph += (f";[3:v]crop='min(iw,ih)':'min(iw,ih)',scale=340:340,format=rgba[f];[4:v]format=gray,scale=340:340[m];"
                          f"[f][m]alphamerge[fm];[sc][fm]overlay=W-400:H-400:shortest=1[v0]")
            else:
                graph += ";[sc]null[v0]"
            graph += ";[v0]format=yuv420p[v];[1:a]apad,aresample=48000[a]"
            run(*inputs, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-t", f"{d}",
                "-c:v", "libx264", "-crf", "18", "-c:a", "aac", str(out))
        parts.append(out)
        print(f"segment {sid} {seg['kind']:6} {d:5.1f}s {'take' if find_take(sid) else 'draft voice'}")

    card_png("github.com/vnmoorthy/wraith", "CrewAI · Parasail · You.com · One — MIT licensed", tmp / "outro.png")
    run("-loop", "1", "-t", "3.2", "-i", str(tmp / "outro.png"), "-f", "lavfi", "-t", "3.2", "-i", "anullsrc=r=48000:cl=stereo",
        "-vf", f"scale={W}:{H},fps={FPS},format=yuv420p,fade=out:st=2.6:d=0.6", "-c:v", "libx264", "-crf", "18", "-c:a", "aac",
        "-shortest", str(tmp / "p99.mp4"))
    parts.append(tmp / "p99.mp4")

    lst = tmp / "parts.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    final = HERE / ("WRAITH-demo-draft.mp4" if draft and not all(find_take(s["id"]) for s in segs) else "WRAITH-demo.mp4")
    run("-f", "concat", "-safe", "0", "-i", str(lst), "-c:v", "libx264", "-crf", "19", "-preset", "medium",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(final))
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{final}  {duration(final):.1f}s")
    return final


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--draft", action="store_true")
    build(ap.parse_args().draft)
