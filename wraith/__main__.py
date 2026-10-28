"""`python -m wraith` serves the station; `python -m wraith check` verifies every partner."""
from __future__ import annotations

import asyncio
import json
import sys

import uvicorn

from . import config


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        from .server import health
        data = asyncio.run(health(fresh=True))
        width = max(len(k) for k in data)
        for name, res in data.items():
            mark = "\033[32m✓\033[0m" if res["ok"] else "\033[31m✗\033[0m"
            print(f"  {mark} {name.ljust(width)}  {res['ms']:>5}ms  {res['detail']}")
        sys.exit(0 if all(r["ok"] for r in data.values()) else 1)
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        print(json.dumps(config.status(), indent=2))
        return
    print(f"\n  👻 WRAITH — the war room that builds itself\n  → http://localhost:{config.PORT}\n")
    uvicorn.run("wraith.server:app", host="0.0.0.0", port=config.PORT, log_level="warning")


if __name__ == "__main__":
    main()
