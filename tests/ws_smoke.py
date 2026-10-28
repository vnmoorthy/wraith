"""Drive one summoning over the WebSocket and print a compact event summary.

    .venv/bin/python tests/ws_smoke.py [fixture|reality|control|autopilot]
"""
from __future__ import annotations

import asyncio
import json
import sys
from collections import Counter
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "wraith" / "fixtures"


async def main(kind: str, url: str = "ws://127.0.0.1:" + __import__("os").environ.get("WRAITH_PORT", "8666") + "/ws") -> int:
    if kind == "control":
        msg = {"type": "summon", "incident": json.loads((FIX / "control-tick.json").read_text())["ticks"][0]}
    elif kind == "reality":
        msg = {"type": "summon", "incident": {"text": "Our checkout API is failing with 5xx errors from AWS us-east-1. Customers cannot pay.", "source": "reality"}}
    elif kind == "autopilot":
        msg = {"type": "autopilot", "practice": True, "dispatch": False, "compile": False}
    elif kind == "tick":
        msg = {"type": "summon", "incident": json.loads((FIX / "outbreak-level-5.json").read_text())["ticks"][0]}
    else:
        msg = {"type": "summon", "incident": json.loads((FIX / "haunted-dashboard.json").read_text())["ticks"][0]}
    counts: Counter = Counter()
    final = {}
    async with websockets.connect(url, max_size=None) as ws:
        await ws.send(json.dumps(msg))
        while True:
            ev = json.loads(await asyncio.wait_for(ws.recv(), timeout=600))
            counts[ev["type"]] += 1
            t = ev["type"]
            if t in ("route", "decision", "agent.done", "manifest.done", "manifest.error", "error", "run.done",
                     "autopilot.judgment", "autopilot.done", "autopilot.error", "trace", "busy"):
                brief = {k: v for k, v in ev.items() if k not in ("run_id", "manifest", "brief", "type")}
                if t == "manifest.done":
                    comps = [c["component"] for c in ev["manifest"].get("ui_components_ordered", [])]
                    brief = {"components": comps, "ms": ev.get("ms"), "ttft_ms": ev.get("ttft_ms")}
                if t == "agent.done":
                    brief = {"agent": ev["agent"], "ok": ev["ok"], "ms": ev["ms"], "brief": str(ev["brief"])[:160]}
                print(f"{ev.get('t', 0):>6}ms {t:<20} {json.dumps(brief, default=str)[:260]}")
                final[t] = ev
            if t in ("run.done",) and kind != "autopilot":
                break
            if t in ("autopilot.done", "autopilot.error", "busy"):
                break
    print("\nevent counts:", dict(counts))
    return 0 if "error" not in final and "manifest.error" not in final else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "fixture")))
