"""WRAITH server: FastAPI + one WebSocket that streams the swarm and the interface as it is compiled."""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, grimoire, one, parasail, scenario, youcom
from .swarm import RUNS_DIR, Run, summon

app = FastAPI(title="WRAITH", version="1.0.0")
STATIC = Path(__file__).resolve().parent / "static"
RECORDINGS = Path(__file__).resolve().parent / "recordings"
LOCK = asyncio.Lock()

REALITY_PRESETS = [
    {"id": "loft-power", "label": "Power fails during demos",
     "text": "Power just failed across the 2nd floor of the AWS Builder Loft at 525 Market St during finalist demos. Emergency lights only, "
             "elevators stopped, roughly 120 attendees, two people reported stuck in the south-east stairwell, Wi-Fi down."},
    {"id": "us-east-1", "label": "Is it us or AWS?",
     "text": "PagerDuty P1 09:14 checkout-api. 5xx_rate_pct 0.3,0.2,0.4,0.3,11.8,23.5 · p99_ms 180,175,190,2400,8100 · "
             "deploy v2.41.0 rolled out at 09:12 · region us-east-1 · North American customers cannot pay. "
             "Is AWS having an incident right now, or did we break it? What should on-call do?"},
    {"id": "wildfire", "label": "Wildfire smoke over the Bay",
     "text": "Heavy wildfire smoke is drifting over the San Francisco Bay Area. Event organizers at 525 Market St want to know whether to "
             "move 300 people indoors, cancel the outdoor afterparty, and what the current air quality is."},
    {"id": "crowd", "label": "Crowd surge at the entrance",
     "text": "Crowd surge at the main entrance of a 40,000-seat stadium after a gate malfunction. Density reported above 5 people per square "
             "metre near Gate C, three people fainted, stewards overwhelmed."},
]


def _fixtures() -> list[dict]:
    out = []
    for name in ("haunted-dashboard", "outbreak-level-5", "control-tick"):
        for t in scenario.fixture_ticks(name):
            label = t.get("incident_id") or f"tick {t.get('tick_id')}"
            out.append({"id": f"{name}:{t.get('incident_id') or t.get('tick_id')}", "scenario": name, "label": label, "incident": t})
    return out


@app.on_event("startup")
async def _startup():
    if config.PARASAIL_API_KEY:
        asyncio.create_task(_warm())


async def _warm():
    """Pay every cold start before the demo does: grimoire, embeddings, each routed model, the oracle."""
    try:
        await grimoire.build()
        await grimoire.search("warm up", k=1)
    except Exception as exc:  # noqa: BLE001
        print(f"[wraith] grimoire not built yet: {exc}")
    try:  # CrewAI builds schemas and executors lazily; run one real kickoff per brief type, one at a time
        from .schemas import ArchivistBrief, CommanderDecision, SentinelBrief, VerifierBrief
        from .swarm import WraithFlow, _agent
        WraithFlow()
        for cls in (SentinelBrief, ArchivistBrief, VerifierBrief, CommanderDecision):
            agent = _agent("Warmup", "warm up", "warm up", config.MODEL_SWARM)
            await asyncio.wait_for(agent.kickoff_async("Return a minimal valid object.", response_format=cls), timeout=40)
    except Exception as exc:  # noqa: BLE001
        print(f"[wraith] crewai warm-up partial: {type(exc).__name__}")
    models = {config.MODEL_ROUTER, config.MODEL_SWARM, config.MODEL_VERIFIER, config.MODEL_COMMANDER, config.MODEL_COMPILER}
    await asyncio.gather(*(parasail.chat([{"role": "user", "content": "ok"}], model=m, max_tokens=4) for m in models),
                         scenario.oracle("ping"), return_exceptions=True)
    print("[wraith] warm: grimoire, embeddings, models, oracle", flush=True)


@app.get("/api/status")
async def status():
    return {**config.status(), "grimoire": grimoire.ready(), "grimoire_size": len(grimoire.ENTRIES),
            "dispatch_live": config.DISPATCH_LIVE}


_health_cache: dict = {"t": 0, "data": None}


@app.get("/api/health")
async def health(fresh: bool = False):
    """Live checks against every partner. Cached for 45s so the header can poll it."""
    if not fresh and _health_cache["data"] and time.time() - _health_cache["t"] < 45:
        return _health_cache["data"]

    async def check(name, coro):
        t0 = time.perf_counter()
        try:
            detail = await asyncio.wait_for(coro, timeout=25)
            return name, {"ok": True, "ms": int((time.perf_counter() - t0) * 1000), "detail": detail}
        except Exception as exc:  # noqa: BLE001
            return name, {"ok": False, "ms": int((time.perf_counter() - t0) * 1000), "detail": str(exc)[:200]}

    async def p():
        models = await parasail.list_models()
        return f"{len(models)} models"

    async def y():
        res = await youcom.search("AWS Builder Loft 525 Market St San Francisco", count=1, highlights=False)
        return f"{len(res['hits'])} hit in {res['latency_ms']}ms"

    async def o():
        conns = await one.list_integrations()
        plats = sorted({c["platform"] for c in conns if c.get("platform")})
        return ", ".join(plats) or "no connections"

    async def s():
        tools = await scenario.list_tools()
        return f"{len(tools)} tools"

    async def c():
        import crewai
        return f"crewai {crewai.__version__}"

    async def d():
        conns = await one.list_integrations()
        if not any(c["platform"] == "discord" for c in conns):
            raise RuntimeError("no Discord connection in One: connect it at app.withone.ai, or Dispatch will stay pending")
        return "Discord connected"

    async def t():
        if not config.TEAM_HANDLE:
            raise RuntimeError("TEAM_HANDLE is not set: Autopilot live mode needs it")
        return config.TEAM_HANDLE

    results = await asyncio.gather(check("parasail", p()), check("youcom", y()), check("one", o()),
                                   check("scenario", s()), check("crewai", c()), check("discord", d()), check("team", t()))
    data = dict(results)
    _health_cache.update(t=time.time(), data=data)
    return data


@app.get("/api/fixtures")
async def fixtures():
    return {"fixtures": _fixtures(), "presets": REALITY_PRESETS}


class DispatchBody(BaseModel):
    run_id: str | None = None
    sector: str = "unknown"
    action: str = "observe"
    rationale: str = ""
    countermeasures: list[str] = []
    civilians: str = ""
    isolated_zones: list[str] = []
    confidence: float | None = None
    threat_level: int | None = None
    citations: list[str] = []
    checklist: str = ""
    headline: str = ""
    urgency: str = "priority"
    dry_run: bool = False
    one_disabled: bool = False


def build_dispatch(b: DispatchBody) -> str:
    """The alert a person would write, rebuilt from what the operator did on the station."""
    sector = b.sector.replace("_", " ").title()
    team = f" ({config.TEAM_HANDLE})" if config.TEAM_HANDLE else ""
    lines = [f"**{b.action.upper()}** — {sector}{team}"]
    if b.rationale:
        lines.append(b.rationale)
    facts = []
    if b.civilians:
        facts.append(f"Civilians: {b.civilians}")
    if b.countermeasures:
        facts.append("Deploying " + ", ".join(c.replace("_", " ") for c in b.countermeasures))
    if b.isolated_zones:
        facts.append("Isolated: " + ", ".join(z.replace("_", " ") for z in b.isolated_zones))
    if b.checklist:
        facts.append("Protocol " + b.checklist)
    if b.confidence is not None:
        facts.append(f"Confidence {round(b.confidence * 100)}%" + (f", threat {b.threat_level}/5" if b.threat_level else ""))
    lines += facts
    if b.citations:
        lines.append("Sources: " + " ".join(f"<{u}>" for u in b.citations[:2]))
    lines.append(f"— Wraith · {b.urgency} · checked against the live web by You.com, sent by One")
    return "\n".join(lines)[:1900]


@app.post("/api/dispatch/preview")
async def dispatch_preview(b: DispatchBody):
    return {"content": build_dispatch(b), "channel_id": config.DISCORD_CHANNEL_ID}


@app.post("/api/dispatch")
async def dispatch(b: DispatchBody):
    if b.one_disabled:
        raise HTTPException(409, "One is ablated: the station can see the threat but cannot act on it")
    content = build_dispatch(b)
    receipt = await one.dispatch_discord(content, dry_run=b.dry_run or not config.DISPATCH_LIVE)
    _append_to_run(b.run_id, {"type": "dispatch", "content": content, "receipt": receipt})
    return {"content": content, "receipt": receipt}


def _append_to_run(run_id: str | None, event: dict) -> None:
    """Dispatches happen after the run; append them so replays include the One loop too."""
    if not run_id:
        return
    path = RUNS_DIR / f"{run_id}.json"
    if not path.exists():
        return
    try:
        data = json.loads(path.read_text())
        last_t = (data.get("events") or [{}])[-1].get("t", 0)
        data["events"].append({**event, "run_id": run_id, "t": last_t + 1500})
        path.write_text(json.dumps(data, default=str))
    except (OSError, json.JSONDecodeError):
        pass


@app.get("/api/one/integrations")
async def one_integrations():
    try:
        return {"connections": await one.list_integrations()}
    except one.OneError as exc:
        raise HTTPException(502, str(exc)) from exc


@app.get("/api/scoreboard")
async def scoreboard():
    try:
        return await scenario.scoreboard()
    except scenario.FeedError as exc:
        raise HTTPException(502, str(exc)) from exc


def _run_files() -> list[Path]:
    files = list(RUNS_DIR.glob("*.json"))
    if RECORDINGS.exists():
        files += list(RECORDINGS.glob("*.json"))
    return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)


@app.get("/api/runs")
async def runs():
    out = []
    for p in _run_files()[:60]:
        try:
            d = json.loads(p.read_text())
        except json.JSONDecodeError:
            continue
        done = [e for e in d.get("events", []) if e.get("type") == "manifest.done"]
        out.append({"id": d["id"], "mode": d.get("mode"), "headline": d.get("headline"),
                    "recorded": p.parent.name == "recordings", "events": len(d.get("events", [])),
                    "components": len(done[0]["manifest"]["ui_components_ordered"]) if done else 0,
                    "duration_ms": (d.get("events") or [{}])[-1].get("t", 0)})
    return {"runs": out}


@app.get("/api/runs/{run_id}")
async def run_detail(run_id: str):
    for p in _run_files():
        if p.stem == run_id:
            return JSONResponse(json.loads(p.read_text()))
    raise HTTPException(404, "no such run")


# --------------------------------------------------------------------------- referee for practice mode
def practice_referee(tick: dict, action: str) -> dict:
    """A local stand-in for the feed's referee, following the published doctrine. Practice only."""
    reports = tick.get("sector_reports", [])
    breached = [r for r in reports if r.get("containment_state") == "breached"]
    pinned = any(r.get("civilian_status") not in (None, "clear") for r in breached)
    if not breached:
        expected = "observe"
    else:
        expected = "evacuate" if pinned else "contain"
    if action == expected:
        score = 1.0
    elif {action, expected} == {"contain", "evacuate"}:
        score = 0.5
    else:
        score = 0.0
    return {"tick_id": tick.get("tick_id"), "expected": expected, "action": action, "score": score,
            "false_alarm": (not breached) and action != "observe", "referee": "practice (local doctrine)"}


def _unwrap_tick(res: dict) -> tuple[dict, bool]:
    tick = res.get("tick") if isinstance(res.get("tick"), dict) else res
    return tick, bool(res.get("exhausted") or tick.get("exhausted"))


# --------------------------------------------------------------------------- websocket
@app.websocket("/ws")
async def ws(socket: WebSocket):
    await socket.accept()
    sender_lock = asyncio.Lock()

    async def send(ev: dict):
        async with sender_lock:
            await socket.send_text(json.dumps(ev, default=str))

    async def pump(run: Run, task: asyncio.Task):
        while True:
            getter = asyncio.create_task(run.queue.get())
            done, _ = await asyncio.wait({getter, task}, return_when=asyncio.FIRST_COMPLETED)
            if getter in done:
                await send(getter.result())
                continue
            getter.cancel()
            while not run.queue.empty():
                await send(run.queue.get_nowait())
            return

    async def do_summon(msg: dict):
        incident = msg.get("incident") or {}
        if not incident:
            await send({"type": "error", "error": "no incident"})
            return
        run = Run(incident, ablate=msg.get("ablate"), mode="warroom")
        task = asyncio.create_task(summon(run))
        await pump(run, task)

    async def do_autopilot(msg: dict):
        practice = bool(msg.get("practice", True))
        auto_dispatch = bool(msg.get("dispatch", False))
        ablate = msg.get("ablate") or {}
        total, judged = 0.0, 0
        await send({"type": "autopilot.start", "practice": practice, "team": config.TEAM_HANDLE})
        for scen in ("outbreak-level-5", "control-tick"):
            fixture = scenario.fixture_ticks(scen)
            previous = None
            for i in range(6):
                if practice:
                    if i >= len(fixture):
                        break
                    tick, exhausted = fixture[i], False
                else:
                    try:
                        res = await scenario.get_tick(scen)
                    except scenario.FeedError as exc:
                        await send({"type": "autopilot.error", "error": str(exc)})
                        return
                    tick, exhausted = _unwrap_tick(res)
                    if exhausted:
                        break
                if previous:
                    tick = {**tick, "_previous": previous}
                await send({"type": "autopilot.tick", "scenario": scen, "tick": tick})
                run = Run(tick, ablate=ablate, mode="autopilot", compile_ui=bool(msg.get("compile", False)))
                task = asyncio.create_task(summon(run))
                await pump(run, task)
                decision = run.state.get("decision") or {}
                action = decision.get("action", "observe")
                if practice:
                    judgment = practice_referee(tick, action)
                else:
                    try:
                        judgment = await scenario.submit(int(tick["tick_id"]), action)
                    except scenario.FeedError as exc:
                        scenario.queue_submission(int(tick["tick_id"]), action)
                        judgment = {"queued": True, "error": str(exc)}
                score = judgment.get("score")
                if isinstance(score, (int, float)):
                    total += score
                    judged += 1
                await send({"type": "autopilot.judgment", "tick_id": tick.get("tick_id"), "action": action,
                            "decision": decision, "judgment": judgment, "run_id": run.id})
                if auto_dispatch and decision.get("escalate") and not ablate.get("one"):
                    route = run.state.get("route") or {}
                    ev = (run.state.get("intel", {}).get("verifier") or {}).get("evidence", [])
                    body = DispatchBody(run_id=run.id, sector=decision.get("priority_sector") or route.get("primary_sector", "?"),
                                        action=action, rationale=decision.get("rationale", ""),
                                        countermeasures=decision.get("countermeasures", [])[:3],
                                        civilians=route.get("civilian_status", ""), confidence=decision.get("confidence"),
                                        threat_level=decision.get("threat_level"), citations=[e["url"] for e in ev[:2]],
                                        urgency="flash")
                    try:
                        out = await dispatch(body)
                        await send({"type": "autopilot.dispatch", "tick_id": tick.get("tick_id"), **out})
                    except HTTPException as exc:
                        await send({"type": "autopilot.dispatch", "tick_id": tick.get("tick_id"), "error": exc.detail})
                previous = {k: v for k, v in tick.items() if k != "_previous"}
        board = None
        if not practice:
            try:
                board = await scenario.scoreboard()
            except scenario.FeedError as exc:
                board = {"error": str(exc)}
        await send({"type": "autopilot.done", "total": total, "judged": judged, "scoreboard": board, "practice": practice})

    try:
        while True:
            msg = json.loads(await socket.receive_text())
            kind = msg.get("type")
            if kind == "ping":
                await send({"type": "pong"})
                continue
            if LOCK.locked():
                await send({"type": "busy", "error": "the swarm is already deliberating; wait for it to finish"})
                continue
            async with LOCK:
                if kind == "summon":
                    await do_summon(msg)
                elif kind == "autopilot":
                    await do_autopilot(msg)
    except WebSocketDisconnect:
        return


DOCS = Path(__file__).resolve().parent.parent / "docs"
if DOCS.exists():
    app.mount("/docs", StaticFiles(directory=DOCS, html=True), name="docs")

if STATIC.exists():
    app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets") if (STATIC / "assets").exists() else None

    @app.get("/{path:path}")
    async def spa(path: str):
        # Only ever serve files that resolve inside the built UI: no traversal to .env or the repo.
        root = STATIC.resolve()
        target = (STATIC / path).resolve()
        if path and target.is_relative_to(root) and target.is_file():
            return FileResponse(target)
        index = STATIC / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(404)
