"""The venue scenario feed, spoken to as a real MCP server (streamable HTTP).

Tools: hack26-get-tick, hack26-submit-containment, hack26-get-scoreboard,
hack26-ask-oracle, hack26-list-scenarios. Falls back to the published fixtures
(identical field names) when the feed is unreachable, and queues submissions.
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from . import config

FIXTURE_FILES = {
    "outbreak-level-5": config.FIXTURES / "outbreak-level-5.json",
    "control-tick": config.FIXTURES / "control-tick.json",
    "haunted-dashboard": config.FIXTURES / "haunted-dashboard.json",
}
QUEUE = config.DATA_DIR / "submission-queue.json"


class FeedError(RuntimeError):
    pass


@asynccontextmanager
async def session():
    async with streamablehttp_client(config.SCENARIO_MCP, timeout=20) as (read, write, _):
        async with ClientSession(read, write) as s:
            await s.initialize()
            yield s


async def call(tool: str, args: dict | None = None) -> dict:
    try:
        async with session() as s:
            res = await s.call_tool(tool, args or {})
    except Exception as exc:  # noqa: BLE001 - network, TLS, protocol: all mean "feed unreachable"
        raise FeedError(f"scenario feed unreachable: {type(exc).__name__}: {str(exc)[:160]}") from exc
    if getattr(res, "isError", False):
        text = res.content[0].text if res.content else "unknown error"
        raise FeedError(text[:300])
    text = res.content[0].text if res.content else "{}"
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"text": text}


async def list_tools() -> list[str]:
    async with session() as s:
        res = await s.list_tools()
    return [t.name for t in res.tools]


def _team_args() -> dict:
    if not config.TEAM_HANDLE:
        raise FeedError("TEAM_HANDLE is not set in .env (it is on your welcome card)")
    args = {"team": config.TEAM_HANDLE}
    if config.TEAM_TOKEN:
        args["token"] = config.TEAM_TOKEN
    return args


async def get_tick(scenario: str) -> dict:
    return await call("hack26-get-tick", {**_team_args(), "scenario": scenario})


async def submit(tick_id: int, action: str) -> dict:
    return await call("hack26-submit-containment", {**_team_args(), "tick_id": tick_id, "action": action})


async def scoreboard() -> dict:
    return await call("hack26-get-scoreboard")


async def oracle(question: str) -> str:
    try:
        res = await call("hack26-ask-oracle", {"question": question[:480]})
        return res.get("answer") or res.get("text") or json.dumps(res)[:400]
    except FeedError as exc:
        return f"(oracle unreachable: {exc})"


def fixture_ticks(name: str) -> list[dict]:
    path = FIXTURE_FILES.get(name)
    if not path or not path.exists():
        return []
    return json.loads(path.read_text()).get("ticks", [])


def queue_submission(tick_id: int, action: str) -> None:
    items = json.loads(QUEUE.read_text()) if QUEUE.exists() else []
    items.append({"tick_id": tick_id, "action": action})
    QUEUE.write_text(json.dumps(items, indent=2))


async def flush_queue() -> list[dict]:
    if not QUEUE.exists():
        return []
    items = json.loads(QUEUE.read_text())
    done, left = [], []
    for it in items:
        try:
            done.append({**it, "judgment": await submit(it["tick_id"], it["action"])})
        except FeedError:
            left.append(it)
    QUEUE.write_text(json.dumps(left, indent=2))
    return done
