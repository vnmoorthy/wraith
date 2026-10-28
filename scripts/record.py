"""Run a set of real incidents through a live WRAITH server and ship the runs as recordings.

    .venv/bin/python scripts/record.py            # needs ./run.sh (or python -m wraith) running with real keys
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from wraith.server import REALITY_PRESETS  # noqa: E402

FIX = ROOT / "wraith" / "fixtures"
RUNS = ROOT / ".wraith" / "runs"
OUT = ROOT / "wraith" / "recordings"
PORT = os.environ.get("WRAITH_PORT", "8666")


def incidents() -> list[tuple[str, dict]]:
    load = lambda name: json.loads((FIX / f"{name}.json").read_text())["ticks"]  # noqa: E731
    presets = {p["id"]: p["text"] for p in REALITY_PRESETS}
    return [
        ("01-haunted-dashboard", load("haunted-dashboard")[0]),
        ("02-tick-142", load("outbreak-level-5")[0]),
        ("03-control-900", load("control-tick")[0]),
        ("04-reality-loft-power", {"text": presets["loft-power"], "source": "reality"}),
        ("05-reality-us-east-1", {"text": presets["us-east-1"], "source": "reality"}),
        ("06-reality-wildfire", {"text": presets["wildfire"], "source": "reality"}),
    ]


async def run_one(label: str, incident: dict) -> str | None:
    async with websockets.connect(f"ws://127.0.0.1:{PORT}/ws", max_size=None) as ws:
        await ws.send(json.dumps({"type": "summon", "incident": incident}))
        run_id, comps = None, 0
        while True:
            ev = json.loads(await asyncio.wait_for(ws.recv(), timeout=300))
            run_id = run_id or ev.get("run_id")
            if ev["type"] == "manifest.done":
                comps = len(ev["manifest"]["ui_components_ordered"])
            if ev["type"] == "run.done":
                print(f"{label:24} run {run_id}  {comps} components  {ev['ms'] / 1000:.1f}s")
                return run_id if comps else None


async def main(only: list[str]) -> None:
    OUT.mkdir(exist_ok=True)
    for label, inc in incidents():
        if only and not any(o in label for o in only):
            continue
        rid = await run_one(label, inc)
        if rid:
            shutil.copy(RUNS / f"{rid}.json", OUT / f"{label}.json")
            data = json.loads((OUT / f"{label}.json").read_text())
            data["id"] = label
            (OUT / f"{label}.json").write_text(json.dumps(data))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
