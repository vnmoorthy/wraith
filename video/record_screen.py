"""Record a WRAITH page to MP4 with Chrome's DevTools screencast (no screen-recording permission needed).

    python video/record_screen.py "http://localhost:8666/?replay=02-tick-142&film=1" out.mp4 --seconds 30
    python video/record_screen.py URL out.mp4 --seconds 25 --click "Dispatch" --click "Confirm: send to Discord"

Frames arrive with timestamps only when the page changes, so each frame is held for exactly as long
as it was on screen; ffmpeg then resamples to a constant 30 fps.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websockets

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


async def record(url: str, out: Path, seconds: float, width: int, height: int, clicks: list[tuple[float, str]],
                 scale: float) -> None:
    port = 9333
    profile = tempfile.mkdtemp(prefix="wraith-rec-")
    chrome = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={port}", f"--user-data-dir={profile}",
                               "--hide-scrollbars", "--disable-gpu", f"--window-size={width},{height}",
                               f"--force-device-scale-factor={scale}", "about:blank"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    frames_dir = Path(tempfile.mkdtemp(prefix="wraith-frames-"))
    try:
        for _ in range(50):
            try:
                tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json").read())
                ws_url = next(t["webSocketDebuggerUrl"] for t in tabs if t.get("type") == "page")
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.2)
        async with websockets.connect(ws_url, max_size=None) as ws:
            seq = 0

            async def send(method: str, params: dict | None = None) -> int:
                nonlocal seq
                seq += 1
                await ws.send(json.dumps({"id": seq, "method": method, "params": params or {}}))
                return seq

            await send("Page.enable")
            await send("Emulation.setDeviceMetricsOverride",
                       {"width": width, "height": height, "deviceScaleFactor": scale, "mobile": False})
            await send("Page.navigate", {"url": url})
            await asyncio.sleep(1.2)
            await send("Page.startScreencast", {"format": "jpeg", "quality": 92, "everyNthFrame": 1,
                                                "maxWidth": int(width * scale), "maxHeight": int(height * scale)})
            frames: list[tuple[float, Path]] = []
            start = time.time()
            pending = sorted(clicks)
            while time.time() - start < seconds:
                if pending and time.time() - start >= pending[0][0]:
                    _, label = pending.pop(0)
                    js = ("(() => { const all = [...document.querySelectorAll('button,a')]; const t = " + json.dumps(label) + ";"
                          " const b = all.find(e => e.textContent.trim() === t) || all.find(e => e.textContent.trim().startsWith(t));"
                          " if (b) { b.scrollIntoView({block:'center'}); b.click(); return true } return false })()")
                    await send("Runtime.evaluate", {"expression": js})
                try:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=0.25))
                except asyncio.TimeoutError:
                    continue
                if msg.get("method") == "Page.screencastFrame":
                    p = msg["params"]
                    path = frames_dir / f"{len(frames):06d}.jpg"
                    path.write_bytes(base64.b64decode(p["data"]))
                    frames.append((p["metadata"]["timestamp"], path))
                    await send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
            await send("Page.stopScreencast")
        if not frames:
            raise SystemExit("no frames captured")
        end_ts = frames[0][0] + seconds
        concat = frames_dir / "frames.txt"
        with concat.open("w") as f:
            for i, (ts, path) in enumerate(frames):
                nxt = frames[i + 1][0] if i + 1 < len(frames) else max(end_ts, ts + 0.04)
                f.write(f"file '{path}'\nduration {max(0.001, nxt - ts):.4f}\n")
            f.write(f"file '{frames[-1][1]}'\n")
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat),
                        "-vf", f"fps=30,scale={width}:{height}:flags=lanczos,format=yuv420p", "-c:v", "libx264",
                        "-preset", "medium", "-crf", "18", str(out)], check=True)
        print(f"{out}  {len(frames)} frames  {seconds:.0f}s")
    finally:
        chrome.terminate()
        shutil.rmtree(profile, ignore_errors=True)
        shutil.rmtree(frames_dir, ignore_errors=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("out")
    ap.add_argument("--seconds", type=float, default=25)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--click", action="append", default=[], help="'SECONDS:button text' clicked at that time")
    a = ap.parse_args()
    clicks = []
    for c in a.click:
        t, _, label = c.partition(":")
        clicks.append((float(t), label))
    asyncio.run(record(a.url, Path(a.out), a.seconds, a.width, a.height, clicks, a.scale))
