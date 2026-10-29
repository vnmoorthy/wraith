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


async def resolve_discord(steps: list | None = None) -> dict:
    """Resolve the Discord connection and the send-message action through One (cached after the first time)."""
    steps = steps if steps is not None else []
    if _resolved.get("discord"):
        steps.extend({**st, "cached": True} for st in _resolved["discord_steps"])
        return _resolved["discord"]
    t0 = time.perf_counter()
    conns = [c for c in await list_integrations() if c["platform"] == "discord" and c.get("state") in (None, "operational")]
    steps.append({"tool": "list_one_integrations", "ms": int((time.perf_counter() - t0) * 1000),
                  "detail": f"{len(conns)} Discord connection{'s' if len(conns) != 1 else ''}"})
    t1 = time.perf_counter()
    action = _resolved.get("find") or await find_action("discord", "send a message to a channel",
                                                        "post a containment alert to the venue incident channel")
    _resolved["find"] = action
    steps.append({"tool": "find_one_actions", "ms": int((time.perf_counter() - t1) * 1000),
                  "detail": f"{action.get('title') or 'no action'} · {action.get('method')} {action.get('path')}"})
    if not action["action_id"]:
        raise OneError("One did not return a Discord send-message action")
    if not conns:
        raise OneError("Discord is not connected in One yet: the request is built, connect Discord at app.withone.ai to send it")
    _resolved["discord"] = {"connection_key": conns[0]["key"], **action}
    _resolved["discord_steps"] = [dict(st) for st in steps]
    return _resolved["discord"]


def _path_var_name(action: dict) -> str:
    m = re.search(r"\{(\w+)\}", action.get("path") or "")
    return m.group(1) if m else "channelId"


async def dispatch_discord(content: str, dry_run: bool = False) -> dict:
    """The three-tool loop, timed step by step. Never raises: a missing connection comes back as `pending`."""
    steps: list = []
    try:
        d = await resolve_discord(steps)
    except OneError as exc:
        return {"ok": False, "pending": True, "error": str(exc), "steps": steps, "channel_id": config.DISCORD_CHANNEL_ID}
    t0 = time.perf_counter()
    args = ["actions", "execute", "discord", d["action_id"], d["connection_key"],
            "--path-vars", json.dumps({_path_var_name(d): config.DISCORD_CHANNEL_ID}),
            "-d", json.dumps({"content": content[:1900]})]
    if dry_run:
        args.append("--dry-run")
    try:
        res = await cli(*args, timeout=60)
    except OneError as exc:
        steps.append({"tool": "execute_one_action", "ms": int((time.perf_counter() - t0) * 1000), "detail": str(exc)[:160], "ok": False})
        return {"ok": False, "error": str(exc), "steps": steps, "channel_id": config.DISCORD_CHANNEL_ID}
    body = res.get("data", res) if isinstance(res, dict) else res
    msg_id = (body or {}).get("id") if isinstance(body, dict) else None
    ms = int((time.perf_counter() - t0) * 1000)
    steps.append({"tool": "execute_one_action", "ms": ms,
                  "detail": ("dry run: request built, not sent" if dry_run else f"message {msg_id}") if (msg_id or dry_run) else "no message id returned"})
    return {
        "ok": bool(msg_id) or dry_run, "dry_run": dry_run, "message_id": msg_id, "channel_id": config.DISCORD_CHANNEL_ID,
        "action_id": d["action_id"], "action_title": d.get("title"), "latency_ms": ms, "steps": steps,
        "jump_url": (f"https://discord.com/channels/{config.DISCORD_GUILD_ID}/{config.DISCORD_CHANNEL_ID}/{msg_id}"
                     if msg_id and config.DISCORD_GUILD_ID else None),
        "raw": _redact(json.dumps(body)[:600]),
    }
