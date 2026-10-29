"""The swarm: a CrewAI Flow that routes an incident, gathers intel, lets partial-knowledge
agents deliberate, has a commander decide, and compiles a live interface.

    intake (@start, Parasail json_schema)  ->  @router: haunting | real_world | control
        -> intel: Sentinel instruments, Archivist grimoire (Parasail embeddings) + oracle (scenario MCP),
                  Verifier live web (You.com search highlights + contents)
        -> Sentinel / Archivist / Verifier CrewAI agents in parallel, each seeing only its slice
        -> Commander CrewAI agent sees only the three briefs and decides
        -> compile: Parasail streams a schema-locked UI manifest, token by token, over the WebSocket
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from typing import Any

os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")

from crewai import LLM, Agent  # noqa: E402
from crewai.flow.flow import Flow, listen, or_, router, start  # noqa: E402

from . import config, grimoire, parasail, scenario, sensors, youcom  # noqa: E402
from .schemas import (CATALOG, COMPONENTS, ArchivistBrief, CommanderDecision, Route,  # noqa: E402
                      SentinelBrief, VerifierBrief, manifest_schema)

RUNS_DIR = config.DATA_DIR / "runs"
RUNS_DIR.mkdir(exist_ok=True)
AGENT_KEYS = {"Sentinel": "sentinel", "Archivist": "archivist", "Verifier": "verifier", "Commander": "commander"}


class Run:
    """One summoning: an event stream that is sent live and recorded for replay."""

    def __init__(self, incident: dict, ablate: dict | None = None, mode: str = "warroom", compile_ui: bool = True):
        self.id = time.strftime("%H%M%S-") + uuid.uuid4().hex[:6]
        self.incident = incident
        self.ablate = {k: bool(v) for k, v in (ablate or {}).items()}
        self.mode = mode
        self.compile_ui = compile_ui
        self.queue: asyncio.Queue = asyncio.Queue()
        self.loop = asyncio.get_running_loop()
        self.t0 = time.perf_counter()
        self.events: list[dict] = []
        self.calls = {"youcom": 0, "parasail": 0, "one": 0, "scenario": 0, "crewai": 0}
        self.state: dict[str, Any] = {}

    def off(self, partner: str) -> bool:
        return self.ablate.get(partner, False)

    def emit(self, event: dict) -> None:
        event = {**event, "run_id": self.id, "t": int((time.perf_counter() - self.t0) * 1000)}
        self.events.append(event)
        self.queue.put_nowait(event)

    def emit_threadsafe(self, event: dict) -> None:
        self.loop.call_soon_threadsafe(self.emit, event)

    def trace(self, partner: str, op: str, ms: int, detail: str = "", ok: bool = True) -> None:
        self.calls[partner] = self.calls.get(partner, 0) + 1
        self.emit({"type": "trace", "partner": partner, "op": op, "ms": ms, "detail": detail[:220], "ok": ok})

    def save(self) -> str:
        path = RUNS_DIR / f"{self.id}.json"
        path.write_text(json.dumps({"id": self.id, "mode": self.mode, "incident": self.incident,
                                    "headline": (self.state.get("route") or {}).get("headline"),
                                    "events": self.events}, default=str))
        return str(path)


ACTIVE: dict[str, Run | None] = {"run": None}


def _install_stream_listener() -> None:
    """Forward CrewAI's LLM stream chunks into the active run, tagged with the agent's role."""
    try:
        from crewai.events.event_bus import crewai_event_bus
        from crewai.events.types.llm_events import LLMStreamChunkEvent
    except Exception:  # noqa: BLE001
        return

    @crewai_event_bus.on(LLMStreamChunkEvent)
    def _on_chunk(source, event):  # noqa: ANN001
        run = ACTIVE.get("run")
        role = getattr(event, "agent_role", None)
        if run and role in AGENT_KEYS and event.chunk:
            run.emit_threadsafe({"type": "agent.token", "agent": AGENT_KEYS[role], "delta": event.chunk})


_install_stream_listener()


def crew_llm(model: str, max_tokens: int = 6000, stream: bool = True, think: bool = False) -> LLM:
    extra = {} if think else config.fast_body(model)
    llm = LLM(model=model, provider="openai", base_url=config.PARASAIL_BASE_URL, api_key=config.PARASAIL_API_KEY,
              temperature=0.25, max_tokens=max_tokens, stream=stream, **({"extra_body": extra} if extra else {}))
    object.__setattr__(llm, "get_context_window_size", lambda: 100_000)
    return llm


def _agent(role: str, goal: str, backstory: str, model: str, think: bool = False) -> Agent:
    return Agent(role=role, goal=goal, backstory=backstory, llm=crew_llm(model, think=think), allow_delegation=False,
                 verbose=False, max_iter=2)


TERSE = "\nBe terse: every string under 25 words, every list at most 4 items. Fill every field of the schema."


async def _kick(run: Run, role: str, agent: Agent, prompt: str, model_cls):
    key = AGENT_KEYS[role]
    prompt = prompt + TERSE
    t0 = time.perf_counter()
    run.calls["crewai"] += 1
    try:
        budget = 30 if role == "Commander" else 25
        try:
            out = await asyncio.wait_for(agent.kickoff_async(prompt, response_format=model_cls), timeout=budget)
        except asyncio.TimeoutError:
            raise
        except Exception as first:  # noqa: BLE001 - CrewAI can race building schemas on a cold start; one retry fixes it
            run.trace("crewai", f"{role.lower()} retry", int((time.perf_counter() - t0) * 1000), f"{type(first).__name__}: retried once", ok=False)
            out = await asyncio.wait_for(agent.kickoff_async(prompt, response_format=model_cls), timeout=budget)
        brief = getattr(out, "pydantic", None)
        data = brief.model_dump() if brief is not None else model_cls.model_validate(parasail.parse_json(out.raw)).model_dump()
        data = json.loads(parasail.clean(json.dumps(data, ensure_ascii=False)))
        ok = True
    except Exception as exc:  # noqa: BLE001 - keep the swarm alive; the commander sees the gap
        data, ok = {"error": f"{type(exc).__name__}: {str(exc)[:200]}"}, False
    ms = int((time.perf_counter() - t0) * 1000)
    run.trace("parasail", f"{role.lower()} · {agent.llm.model}", ms, "CrewAI agent kickoff (json_schema)", ok)
    run.emit({"type": "agent.done", "agent": key, "brief": data, "ms": ms, "ok": ok})
    return data


def _incident_text(incident: dict) -> str:
    if incident.get("raw_incident_stream"):
        return incident["raw_incident_stream"]
    if incident.get("text"):
        return incident["text"]
    return json.dumps(incident, indent=1)[:4000]


ROUTER_SYSTEM = """You are the intake router of WRAITH, an incident command swarm at the AWS Builder Loft (525 Market St, San Francisco).
Classify the incident:
- haunting: a paranormal / spooky facility incident (the Halloween scenario feed, ghost sightings, EMF, cold spots)
- real_world: a real-life emergency or operational incident (outages, fires, weather, crowds, medical, cyber) anywhere
- control: harmless or scheduled activity with normal readings (e.g. a human crowd, a drill, a test) that must NOT be escalated
Extract facts. Never invent numbers that are not in the incident.
For incidents at the Builder Loft, primary_sector MUST be one of these ids: entrance, registration, main_stage,
catering_coffee_bar, network_closet, lounge, workshop_a, workshop_b, stairwell_west, stairwell_se.
Elsewhere use a short snake_case id (e.g. us_east_1, gate_c, bay_area). verification_queries are 2 short keyword web queries
(under 10 words each) that the live web can answer
(for hauntings: rule out mundane causes such as current San Francisco weather or a local power/network outage near 525 Market St;
for real incidents: confirm the incident from news and official status pages)."""


def _redact_oracle(text: str | None) -> str | None:
    """The Archivist is blind to instruments: strip any sensor numbers the oracle echoes back."""
    if not text or re.search(r"truncated|awaiting full doctrine", text, re.I):
        return None
    text = re.sub(r"SENSORS?:[^.\n]*[.\n]?", "", text, flags=re.I)
    text = re.sub(r"-?\d+(?:\.\d+)?\s*(?:mG|milligauss|°\s*C|C\b|motion(?: events)?)", "[redacted]", text, flags=re.I)
    return text.strip() or None


class WraithFlow(Flow):
    """CrewAI Flow: deterministic routing, partial-knowledge deliberation, generative interface."""

    run: Any = None

    @start()
    async def intake(self):
        run = self.run
        assert run is not None
        t0 = time.perf_counter()
        if not (run.incident.get("source") == "reality"):
            run.state["oracle_task"] = asyncio.create_task(scenario.oracle(
                "Containment doctrine for this incident: " + _incident_text(run.incident)[:380]))
        route = await parasail.chat_json(
            [{"role": "system", "content": ROUTER_SYSTEM},
             {"role": "user", "content": _incident_text(run.incident)}],
            schema=Route.model_json_schema(), model=config.MODEL_ROUTER, schema_name="route", max_tokens=1500)
        route = json.loads(parasail.clean(json.dumps(Route.model_validate(route).model_dump(), ensure_ascii=False)))
        if route["incident_class"] == "control":
            route["severity_tier"] = "ALL_CLEAR"
        elif route["severity_tier"] == "ALL_CLEAR":
            # A real incident is never "all clear": people at risk make it severe.
            route["severity_tier"] = "SEVERE" if route.get("civilians_at_risk", 0) > 0 else "ELEVATED"
        run.trace("parasail", f"router · {config.MODEL_ROUTER}", int((time.perf_counter() - t0) * 1000),
                  "json_schema-locked classification")
        run.state["route"] = route
        run.emit({"type": "route", "route": route, "branch": route["incident_class"]})
        return route

    @router(intake)
    def branch(self):
        return self.run.state["route"]["incident_class"]

    @listen("haunting")
    async def on_haunting(self):
        await self._deliberate("haunting")

    @listen("real_world")
    async def on_real_world(self):
        await self._deliberate("real_world")

    @listen("control")
    async def on_control(self):
        await self._deliberate("control")

    async def _intel(self, branch: str) -> dict:
        """Run every agent's tools in parallel. Each result lands only in its owner's slice."""
        run = self.run
        route = run.state["route"]
        tick = run.incident if run.incident.get("sector_reports") else None

        async def sentinel_tool():
            if tick:
                return {"sector_scores": sensors.score_tick(tick, run.incident.get("_previous"))}
            text = _incident_text(run.incident)
            readings = sensors.readings_from_text(text)
            if readings:
                report = {"sector": route["primary_sector"], "sensors": readings}
                return {"sector_scores": [sensors.score_sector(report)], "note": "readings extracted from the incident text"}
            series = sensors.series_from_text(text)
            if series:
                return {"sector_scores": [], "series": series, "note": "telemetry series extracted from the alert"}
            return {"sector_scores": [], "note": "no instrument readings in this incident"}

        async def archivist_tool():
            kinds = ("countermeasure", "entity", "doctrine", "venue") if branch != "real_world" else ("playbook", "doctrine")
            t0 = time.perf_counter()

            hits = await grimoire.search(route["lore_query"] + " " + route["entity_or_hazard"], k=6, kinds=kinds)
            run.trace("parasail", f"embeddings · {config.MODEL_EMBED}", int((time.perf_counter() - t0) * 1000),
                      f"grimoire retrieval: {hits[0]['id'] if hits else 'none'} @ {hits[0]['similarity'] if hits else 0}")
            oracle = None
            task = run.state.get("oracle_task")
            if branch == "haunting" and task is not None:
                # The oracle was asked at intake, in parallel with the router; give it a short grace period.
                left = max(0.5, 7.5 - (time.perf_counter() - run.t0))
                try:
                    oracle = _redact_oracle(await asyncio.wait_for(asyncio.shield(task), timeout=left))
                    run.trace("scenario", "hack26-ask-oracle", int((time.perf_counter() - run.t0) * 1000),
                              (oracle or "no doctrine in the answer")[:120])
                except asyncio.TimeoutError:
                    run.trace("scenario", "hack26-ask-oracle", int(left * 1000), "oracle slow: grimoire doctrine used instead", ok=False)
            return {"grimoire": hits, "oracle": oracle}

        async def verifier_tool():
            if run.off("youcom"):
                return {"evidence": [], "disabled": True}
            evidence, seen = [], set()
            t0 = time.perf_counter()
            results = await asyncio.gather(*(youcom.search(q, count=5) for q in route["verification_queries"][:2]),
                                           return_exceptions=True)
            for q, res in zip(route["verification_queries"][:2], results):
                if isinstance(res, Exception):
                    run.trace("youcom", "search", int((time.perf_counter() - t0) * 1000), f"{q}: {res}", ok=False)
                    continue
                run.trace("youcom", "search (highlights)", res["latency_ms"], f"“{q}” → {len(res['hits'])} hits")
                for h in res["hits"]:
                    if h["url"] in seen:
                        continue
                    seen.add(h["url"])
                    evidence.append({**h, "id": len(evidence) + 1, "query": q})
            top = [e["url"] for e in evidence[:2]]
            if top:
                t1 = time.perf_counter()
                try:
                    pages = await youcom.contents(top)
                    run.trace("youcom", "contents", int((time.perf_counter() - t1) * 1000), f"{len(pages)} pages → markdown")
                    by_url = {p["url"]: p for p in pages}
                    for e in evidence:
                        if e["url"] in by_url:
                            e["excerpt"] = by_url[e["url"]]["text"][:1400]
                except Exception as exc:  # noqa: BLE001
                    run.trace("youcom", "contents", int((time.perf_counter() - t1) * 1000), str(exc), ok=False)
            return {"evidence": evidence[:10]}

        jobs = {"sentinel": sentinel_tool(), "archivist": archivist_tool()}
        if branch != "control":
            jobs["verifier"] = verifier_tool()
        tools = {"sentinel": "scoring instruments…", "archivist": "searching the grimoire (BGE-M3) + oracle…",
                 "verifier": "searching the live web (You.com)…"}
        for key in jobs:
            run.emit({"type": "agent.tools", "agent": key, "label": tools[key]})
        done = await asyncio.gather(*jobs.values(), return_exceptions=True)
        intel = {}
        for key, val in zip(jobs, done):
            intel[key] = val if not isinstance(val, Exception) else {"error": str(val)[:200]}
            run.emit({"type": "intel", "agent": key, "intel": intel[key]})
        return intel

    async def _deliberate(self, branch: str):
        run = self.run
        route = run.state["route"]
        intel = await self._intel(branch)
        run.state["intel"] = intel
        swarm_model = config.MODEL_SWARM

        slices = {
            "sentinel": {"knows": ["sensor readings", "baseline z-scores", "EMF trend"],
                         "blind": ["sighting descriptions", "lore", "live web"]},
            "archivist": {"knows": ["entity class", "grimoire retrieval", "oracle doctrine"],
                          "blind": ["raw sensor numbers", "live web"]},
            "verifier": {"knows": ["checkable claims", "You.com search highlights", "fetched page contents"],
                         "blind": ["sensors", "lore", "countermeasures"]},
        }
        agents = {}
        sent = intel.get("sentinel", {})
        agents["Sentinel"] = (
            _agent("Sentinel", "Read the instruments and nothing else; say whether the signal is real.",
                   "A sensor analyst wired into the venue's EMF, thermal and motion arrays. Distrusts stories, trusts numbers.",
                   swarm_model),
            "You are the Sentinel. You see ONLY instrument data.\n"
            f"SECTOR SCORES (z-scores vs venue baseline, signature 0-1):\n{json.dumps(sent.get('sector_scores'), indent=1)}\n"
            + (f"TELEMETRY SERIES (oldest → newest): {json.dumps(sent.get('series'))}\nRead the trend: when did it break, how far from baseline?\n" if sent.get("series") else "")
            + ("" if sent.get("sector_scores") or sent.get("series") else f"No instrument feed. Quantitative signals from the report: {route['key_claims']}\n")
            + "Motion without EMF or cold is people, not entities. Give your brief.",
            SentinelBrief)
        arch = intel.get("archivist", {})
        agents["Archivist"] = (
            _agent("Archivist", "Match the threat to the grimoire and doctrine; pick countermeasures by entry id.",
                   "Keeper of the WRAITH grimoire of countermeasures, entity profiles, doctrine and real-world playbooks.",
                   swarm_model),
            "You are the Archivist. You see ONLY the entity/hazard description and your grimoire.\n"
            f"THREAT: {route['entity_or_hazard']} · civilians: {route['civilian_status']}\n"
            f"GRIMOIRE HITS (id, similarity, text):\n" + "\n".join(
                f"- {h['id']} ({h['similarity']}): {h['title']} — {h['text']}" for h in arch.get("grimoire", []))
            + (f"\nORACLE DOCTRINE: {arch.get('oracle')}" if arch.get("oracle") else "")
            + "\nbest_countermeasures must be ids from the list above.",
            ArchivistBrief)
        if branch != "control":
            ver = intel.get("verifier", {})
            ev_lines = "\n".join(
                f"[{e['id']}] {e['title']} ({e['url']}) · published {str(e.get('page_age') or 'undated')[:10]}\n    {' | '.join(e.get('snippets') or [e.get('description', '')])[:400]}"
                + (f"\n    PAGE: {e['excerpt'][:350]}" if e.get("excerpt") else "")
                for e in ver.get("evidence", [])[:6])
            agents["Verifier"] = (
                _agent("Verifier", "Check every claim against the live web and rule out mundane causes.",
                       "A field verifier with a live line to the open web through You.com. Cites everything.",
                       config.MODEL_VERIFIER),
                "You are the Verifier. You see ONLY the checkable claims and live web evidence.\n"
                f"TODAY: {time.strftime('%Y-%m-%d %H:%M')} local. A source older than 3 days cannot confirm that something is happening now: treat it as history.\n"
                f"CLAIMS: {json.dumps(route['key_claims'])}\n"
                f"EVIDENCE:\n{ev_lines or '(none: the web was unreachable or grounding is disabled — say so, credibility 0.3)'}\n"
                "How to judge: the web cannot see inside the building. For a paranormal incident your job is to rule out MUNDANE causes."
                " If the web shows normal outdoor weather, the indoor cold is NOT explained by weather; if it shows no power/network"
                " outage at the address, the disruption is NOT explained by the grid. Then mundane_cause_ruled_out is true and those"
                " claims stay unverified (not contradicted). Only mark a claim contradicted when a source directly refutes it."
                " For a real-world incident, confirm or refute the wider event (provider status, outages, weather, AQI) from news and"
                " status pages. Local first-hand facts (people stuck, alarms, injuries) can never be on the web: list them as unverified"
                " but say they are first-hand operator reports, not doubtful. citations are evidence ids.",
                VerifierBrief)

        for role, (agent, _, _) in agents.items():
            key = AGENT_KEYS[role]
            run.emit({"type": "agent.start", "agent": key, "model": agent.llm.model, **slices.get(key, {})})
        results = await asyncio.gather(*(_kick(run, role, a, p, cls) for role, (a, p, cls) in agents.items()))
        briefs = {AGENT_KEYS[role]: res for role, res in zip(agents, results)}
        run.state["briefs"] = briefs

        run.emit({"type": "agent.start", "agent": "commander", "model": config.MODEL_COMMANDER,
                  "knows": ["the agents' briefs", "civilian status"], "blind": ["raw sensors", "raw web pages", "lore text"]})
        commander = _agent(
            "Commander", "Fuse the briefs into one containment decision. Never escalate a harmless control event.",
            "Incident commander of the WRAITH swarm. Decides contain, evacuate or observe under doctrine: "
            "EVACUATE when civilians are in the contact zone or the threat is mobile; CONTAIN when localised with no civilian exposure; "
            "OBSERVE when non-hostile, unknown origin, or a control/crowd event. When in doubt: observe. "
            "Life safety first: an operator's first-hand report of people trapped, pinned or injured is authoritative even when the "
            "web cannot confirm it; web verification shapes cause and scope, never whether to protect people.",
            config.MODEL_COMMANDER, think=True)
        def commander_prompt(verifier_brief) -> str:
            return (f"INCIDENT: {route['headline']} · class {branch} · severity {route['severity_tier']}\n"
                    f"PRIMARY SECTOR: {route['primary_sector']} · CIVILIANS: {route['civilian_status']} ({route['civilians_at_risk']} at risk)\n"
                    f"SENTINEL BRIEF: {json.dumps(briefs.get('sentinel'))}\n"
                    f"ARCHIVIST BRIEF: {json.dumps(briefs.get('archivist'))}\n"
                    f"VERIFIER BRIEF: {json.dumps(verifier_brief)}\n"
                    "Decide. countermeasures are grimoire ids from the Archivist brief.")

        async def counterfactual():
            """The same Commander, same briefs, but the live web never answered: what would it have decided?"""
            if branch == "control" or run.off("youcom") or not isinstance(briefs.get("verifier"), dict):
                return None
            try:
                alt = await parasail.chat_json(
                    [{"role": "system", "content": commander.backstory},
                     {"role": "user", "content": commander_prompt("unavailable: the live web did not answer") + TERSE}],
                    schema=CommanderDecision.model_json_schema(), model=config.MODEL_COMMANDER,
                    schema_name="CommanderDecision", max_tokens=1500)
                return {"action": alt.get("action"), "confidence": alt.get("confidence"), "rationale": alt.get("rationale")}
            except Exception:  # noqa: BLE001 - the counterfactual is a bonus, never a blocker
                return None

        decision, alt = await asyncio.gather(
            _kick(run, "Commander", commander, commander_prompt(briefs.get("verifier", "not consulted: control branch")),
                  CommanderDecision),
            counterfactual())
        if "error" in decision:
            votes = [b.get("recommends") for b in briefs.values() if isinstance(b, dict) and b.get("recommends")]
            action = max(set(votes), key=votes.count) if votes else "observe"
            decision = {"action": action, "confidence": 0.5, "threat_level": 3, "priority_sector": route["primary_sector"],
                        "rationale": f"commander unreachable; majority of agents recommend {action}",
                        "countermeasures": (briefs.get("archivist") or {}).get("best_countermeasures", [])[:2],
                        "dissent": "fallback vote", "escalate": action != "observe", "civilians_plan": route["civilian_status"]}
        if branch == "control":
            decision["escalate"] = False
        run.state["decision"] = decision
        run.emit({"type": "decision", "decision": decision})
        if alt:
            run.state["counterfactual"] = alt
            run.emit({"type": "counterfactual", "without": "youcom", "decision": alt})

    @listen(or_(on_haunting, on_real_world, on_control))
    async def compile(self):
        if self.run.compile_ui:
            await compile_station(self.run)


COMPILER_SYSTEM = f"""You are WRAITH's interface compiler. You do not answer in prose: you emit the JSON manifest of a
functional tactical command station, built for THIS incident, that an operator will actually use.
Component catalog (pick, order and fill them; props must use the real numbers and ids from the facts):
{CATALOG}
Rules:
- 6 to 9 components, ordered by operational priority for this incident. ThreatHeader first. Include DispatchConsole when the
  commander escalates, and put DecisionCard right before it. A control / all-clear event gets a calm, minimal station (no dispatch urgency: use hold).
- Always include EvidenceRail when EVIDENCE is non-empty (cite the evidence ids behind each claim), and CountermeasureSelector
  with grimoire countermeasure/playbook ids so the operator can choose what to deploy.
- Only include EMFRadar if there are EMF readings. Use SectorMap layout aws_builder_loft for incidents at the Builder Loft, generic otherwise.
- EvidenceRail evidence_ids and GrimoireHits entry_ids must come from the facts. Never invent URLs.
- source = which agent's intel the component is built from (router, sentinel, archivist, verifier, commander).
- why = one short phrase on why this component is on screen.
- theme: spectral-goth-dark for hauntings, hellfire-red for mass-casualty threats, ectoplasm-green for contained/all-clear,
  abyssal-blue for cyber/outage, daylight-ops for ordinary real-world operations."""


async def compile_station(run: Run, generic: bool = False) -> dict | None:
    """Stream a schema-locked UI manifest from Parasail and forward every token."""
    if run.off("parasail"):
        run.emit({"type": "manifest.error", "error": "Parasail is ablated: no model, no interface. The station cannot assemble."})
        return None
    facts = _facts(run, generic)
    messages = [{"role": "system", "content": COMPILER_SYSTEM},
                {"role": "user", "content": "FACTS:\n" + json.dumps(facts, indent=1, default=str)[:14000]}]
    run.emit({"type": "manifest.start", "model": config.MODEL_COMPILER})
    t0 = time.perf_counter()
    buf, first = [], None
    try:
        try:
            gen = parasail.stream(messages, schema=manifest_schema(), max_tokens=3200)
            async for piece in gen:
                first = first or time.perf_counter()
                buf.append(piece)
                run.emit({"type": "manifest.delta", "delta": parasail.clean(piece)})
        except parasail.ParasailError as exc:
            if buf or "400" not in str(exc):
                raise
            # The server refused the schema: fall back to JSON mode, still streamed.
            run.trace("parasail", "json_schema refused → json_object", 0, str(exc)[:160], ok=False)
            res = await parasail.client().chat.completions.create(
                model=config.MODEL_COMPILER, messages=messages, max_tokens=3200, stream=True,
                response_format={"type": "json_object"})
            async for chunk in res:
                piece = chunk.choices[0].delta.content if chunk.choices else None
                if piece:
                    first = first or time.perf_counter()
                    buf.append(piece)
                    run.emit({"type": "manifest.delta", "delta": piece})
    except Exception as exc:  # noqa: BLE001
        run.emit({"type": "manifest.error", "error": f"{type(exc).__name__}: {str(exc)[:240]}"})
        return None
    text = "".join(buf)
    ms = int((time.perf_counter() - t0) * 1000)
    ttft = int(((first or time.perf_counter()) - t0) * 1000)
    try:
        manifest = parasail.parse_json(text)
    except Exception as exc:  # noqa: BLE001
        run.emit({"type": "manifest.error", "error": f"manifest did not parse: {exc}"})
        return None
    comps = [c for c in manifest.get("ui_components_ordered", [])
             if isinstance(c, dict) and c.get("component") in COMPONENTS and isinstance(c.get("props"), dict)]
    manifest["ui_components_ordered"] = comps
    title = str(manifest.get("station_title") or "").lstrip(",;:.- ").strip()
    if len(title) < 4:
        title = f"{(run.state.get('route') or {}).get('headline') or 'Incident'} — Command Station"
    manifest["station_title"] = title
    run.trace("parasail", f"compiler · {config.MODEL_COMPILER}", ms,
              f"streamed {len(text)} chars, first token {ttft}ms, {len(comps)} components")
    run.state["manifest"] = manifest
    run.emit({"type": "manifest.done", "manifest": manifest, "ms": ms, "ttft_ms": ttft, "chars": len(text)})
    return manifest


def _facts(run: Run, generic: bool) -> dict:
    if generic:
        return {"incident": _incident_text(run.incident), "note": "no swarm: CrewAI ablated, compile from the raw text only"}
    intel = run.state.get("intel", {})
    return {
        "incident": _incident_text(run.incident)[:2500],
        "incident_id": run.incident.get("incident_id") or (f"tick-{run.incident['tick_id']}" if run.incident.get("tick_id") else f"inc-{run.id}"),
        "route": run.state.get("route"),
        "sentinel": {"scores": intel.get("sentinel", {}).get("sector_scores"), "brief": run.state["briefs"].get("sentinel")},
        "archivist": {"brief": run.state["briefs"].get("archivist"),
                      "GRIMOIRE": [{"id": h["id"], "title": h["title"], "kind": h["kind"], "efficacy": h["efficacy"],
                                    "similarity": h["similarity"]} for h in intel.get("archivist", {}).get("grimoire", [])]},
        "verifier": {"brief": run.state["briefs"].get("verifier"),
                     "EVIDENCE": [{"id": e["id"], "title": e["title"], "url": e["url"],
                                   "snippet": " ".join(e.get("snippets") or [e.get("description", "")])[:240]}
                                  for e in intel.get("verifier", {}).get("evidence", [])]},
        "commander": run.state.get("decision"),
        "dispatch_channel": "#loft-incident",
    }


async def summon(run: Run) -> dict:
    """Run the whole pipeline for one incident. Returns the final state."""
    ACTIVE["run"] = run
    run.emit({"type": "run.start", "incident": run.incident, "mode": run.mode, "ablate": run.ablate,
              "models": config.status()["models"]})
    try:
        if run.off("parasail"):
            run.emit({"type": "route", "route": None, "branch": None,
                      "error": "Parasail ablated: the swarm has no brain"})
            await compile_station(run)
        elif run.off("crewai"):
            run.emit({"type": "route", "route": None, "branch": "none",
                      "error": "CrewAI ablated: one model call, no swarm, no routing"})
            await compile_station(run, generic=True)
        else:
            flow = WraithFlow()
            object.__setattr__(flow, "run", run)
            await flow.kickoff_async()
    except Exception as exc:  # noqa: BLE001
        run.emit({"type": "error", "error": f"{type(exc).__name__}: {str(exc)[:300]}"})
    finally:
        ACTIVE["run"] = None
        run.emit({"type": "run.done", "calls": run.calls, "ms": int((time.perf_counter() - run.t0) * 1000)})
        run.save()
    return run.state
