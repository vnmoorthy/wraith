"""Build the hosted replay viewer into docs/app for GitHub Pages.

Copies the curated recordings in wraith/recordings (real runs, saved from .wraith/runs) next to a
static build of the UI, so anyone can watch them re-stream with their original timing.

    python scripts/publish_pages.py
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REC = ROOT / "wraith" / "recordings"
APP = ROOT / "docs" / "app"
sys.path.insert(0, str(ROOT))


def main() -> None:
    env = {**os.environ, "VITE_STATIC": "1"}
    subprocess.run(["npx", "vite", "build", "--base", "./", "--outDir", str(APP), "--emptyOutDir"],
                   cwd=ROOT / "web", env=env, check=True)
    out = APP / "recordings"
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for p in sorted(REC.glob("*.json"), key=lambda p: p.name):
        d = json.loads(p.read_text())
        shutil.copy(p, out / p.name)
        done = [e for e in d.get("events", []) if e.get("type") == "manifest.done"]
        index.append({"id": d["id"], "mode": d.get("mode"), "headline": d.get("headline"), "recorded": True,
                      "events": len(d.get("events", [])),
                      "components": len(done[0]["manifest"]["ui_components_ordered"]) if done else 0,
                      "duration_ms": (d.get("events") or [{}])[-1].get("t", 0)})
    (out / "index.json").write_text(json.dumps({"runs": index}))
    from wraith.server import REALITY_PRESETS, _fixtures
    (out / "fixtures.json").write_text(json.dumps({"fixtures": _fixtures(), "presets": REALITY_PRESETS}))
    print(f"docs/app: {len(index)} recordings")


if __name__ == "__main__":
    main()
