"""One: the actuator. Real actions in real apps through the three-tool loop.

list_one_integrations -> find_one_actions -> execute_one_action, driven through the
One CLI (`one --agent ...`, JSON out, never prompts). The Discord action id and the
connection key are resolved at run time, never hardcoded. The payload is built from
the live station state by the caller.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import time

from . import config

SECRET_RE = re.compile(r"sk_(?:live|test)_[A-Za-z0-9_-]+")


class OneError(RuntimeError):
    pass


def _redact(s: object) -> str:
    return SECRET_RE.sub("sk_***", str(s))


def _bin() -> str:
    found = shutil.which("one")
    if found:
        return found
    nvm = os.path.expanduser("~/.nvm/versions/node")
    if os.path.isdir(nvm):
        for v in sorted(os.listdir(nvm), reverse=True):
            cand = os.path.join(nvm, v, "bin", "one")
            if os.path.exists(cand):
                return cand
    raise OneError("the One CLI is not installed: npm i -g @withone/cli")


async def cli(*args: str, timeout: int = 90) -> dict | list:
    env = dict(os.environ)
    if config.ONE_SECRET:
        env["ONE_SECRET"] = config.ONE_SECRET
    bindir = os.path.dirname(_bin())
    env["PATH"] = bindir + os.pathsep + env.get("PATH", "")
    proc = await asyncio.create_subprocess_exec(
        _bin(), "--agent", *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env,
        cwd=str(config.ROOT))
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError as exc:
        proc.kill()
        raise OneError(f"one {args[0]} timed out") from exc
    text = out.decode().strip() or err.decode().strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = None
        for line in reversed(text.splitlines()):
            line = line.strip()
            if line.startswith("{") or line.startswith("["):
                try:
                    data = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue
        if data is None:
            raise OneError(f"one {args[0]}: {_redact(text[:240])}")
    if isinstance(data, dict) and data.get("error"):
        raise OneError(f"one {args[0]}: {_redact(data['error'])[:240]}")
    return data


_resolved: dict = {}


async def ensure_init() -> None:
    """Configure the CLI from ONE_SECRET the first time (headless `one init --auth manual`)."""
    if _resolved.get("init"):
        return
    try:
        await cli("whoami", timeout=30)
    except OneError as exc:
        if "not configured" not in str(exc).lower() or not config.ONE_SECRET:
            raise
        await cli("init", "-y", "--auth", "manual", "--api-key", config.ONE_SECRET, timeout=120)
    _resolved["init"] = True


async def list_integrations() -> list[dict]:
    """Tool 1 of 3: what am I connected to, and with what access."""
    if not config.ONE_SECRET:
        raise OneError("ONE_SECRET is not set")
    await ensure_init()
    data = await cli("list", "--limit", "100")
    rows = data.get("connections", []) if isinstance(data, dict) else data
    return [{"platform": r.get("platform"), "key": r.get("key"), "state": r.get("state"),
             "access": r.get("access"), "name": r.get("name") or r.get("platform")} for r in rows]


async def find_action(platform: str, intent: str, task: str) -> dict:
    """Tool 2 of 3: which action does this step need, and how is it called."""
    data = await cli("actions", "find", platform, intent, "--task", task, "--ai-model", config.MODEL_COMMANDER,
                     "--no-knowledge")
    chosen = _first_action(data) or {}
    return {
        "action_id": chosen.get("actionId") or chosen.get("action_id") or chosen.get("systemId"),
        "title": chosen.get("title"),
        "method": chosen.get("method"),
        "path": chosen.get("path"),
    }


def _first_action(node) -> dict | None:
    """The chosen action is the first object carrying an action id, wherever the CLI nests it."""
    if isinstance(node, dict):
        if node.get("actionId") or node.get("action_id") or node.get("systemId"):
            return node
        for key in ("chosen", "action", "results", "requests", "actions", "data"):
            if key in node:
                hit = _first_action(node[key])
                if hit:
                    return hit
        for value in node.values():
            hit = _first_action(value)
            if hit:
                return hit
    elif isinstance(node, list):
        for item in node:
            hit = _first_action(item)
            if hit:
                return hit
    return None


async def resolve_discord() -> dict:
    """Resolve (once) the Discord connection and the send-message action, through One."""
    if _resolved.get("discord"):
        return _resolved["discord"]
    t0 = time.perf_counter()
    conns = [c for c in await list_integrations() if c["platform"] == "discord" and c.get("state") in (None, "operational")]
    if not conns:
        raise OneError("Discord is not connected in One. Connect it at app.withone.ai (write access) and retry")
    action = await find_action("discord", "send a message to a channel",
                               "post a containment alert to the venue incident channel")
    if not action["action_id"]:
        raise OneError("One did not return a Discord send-message action")
    _resolved["discord"] = {"connection_key": conns[0]["key"], **action,
                            "resolve_ms": int((time.perf_counter() - t0) * 1000)}
    return _resolved["discord"]


def _path_var_name(action: dict) -> str:
    m = re.search(r"\{(\w+)\}", action.get("path") or "")
    return m.group(1) if m else "channelId"


async def dispatch_discord(content: str, dry_run: bool = False) -> dict:
    """Tool 3 of 3: execute. Posts `content` to the venue channel and returns a receipt."""
    d = await resolve_discord()
    t0 = time.perf_counter()
    args = ["actions", "execute", "discord", d["action_id"], d["connection_key"],
            "--path-vars", json.dumps({_path_var_name(d): config.DISCORD_CHANNEL_ID}),
            "-d", json.dumps({"content": content[:1900]})]
    if dry_run:
        args.append("--dry-run")
    res = await cli(*args, timeout=60)
    body = res.get("data", res) if isinstance(res, dict) else res
    msg_id = (body or {}).get("id") if isinstance(body, dict) else None
    return {
        "ok": bool(msg_id) or dry_run,
        "dry_run": dry_run,
        "message_id": msg_id,
        "channel_id": config.DISCORD_CHANNEL_ID,
        "action_id": d["action_id"],
        "action_title": d.get("title"),
        "latency_ms": int((time.perf_counter() - t0) * 1000),
        "jump_url": f"https://discord.com/channels/@me/{config.DISCORD_CHANNEL_ID}/{msg_id}" if msg_id else None,
        "raw": _redact(json.dumps(body)[:600]),
    }
