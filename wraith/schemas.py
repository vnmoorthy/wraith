"""Shapes the swarm agrees on: router output, agent briefs, the commander's decision, the UI manifest."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Route(BaseModel):
    incident_class: Literal["haunting", "real_world", "control"]
    headline: str = Field(description="one-line incident headline")
    severity_tier: Literal["CRITICAL_HAUNT", "SEVERE", "ELEVATED", "GUARDED", "ALL_CLEAR"]
    primary_sector: str = Field(description="sector/zone/region most affected, snake_case")
    entity_or_hazard: str = Field(description="entity class or hazard type, e.g. level-5-phantom, region-outage, wildfire")
    civilians_at_risk: int
    civilian_status: str
    key_claims: list[str] = Field(description="2-4 factual claims that can be checked against the live web")
    verification_queries: list[str] = Field(description="2 web search queries that would confirm or refute the claims or rule out mundane causes")
    lore_query: str = Field(description="what to look up in the countermeasure / playbook grimoire")


class SentinelBrief(BaseModel):
    threat_signal: Literal["anomalous", "elevated", "baseline", "crowd-like"] = Field(
        description="anomalous when signature_score >= 0.6; crowd-like only for motion without EMF or cold")
    hottest_sector: str
    signature_score: float
    trend: str = Field(description="rising / falling / steady / unknown, with numbers")
    reading: str = Field(description="two sentences on what the instruments say, with numbers")
    recommends: Literal["contain", "evacuate", "observe"]


class ArchivistBrief(BaseModel):
    hostile: bool
    mobile: bool
    entity_profile: str = Field(description="one full sentence: what this entity or hazard is and how it behaves")
    best_countermeasures: list[str] = Field(description="ids of countermeasure or playbook entries only (never entity_, doctrine_ or venue_ ids), best first")
    doctrine: str = Field(description="which doctrine applies and why, one sentence")
    recommends: Literal["contain", "evacuate", "observe"]


class VerifierBrief(BaseModel):
    confirmed: list[str]
    contradicted: list[str]
    unverified: list[str]
    mundane_cause_ruled_out: bool
    credibility: float = Field(description="0-1 how well the live web supports the incident being real")
    citations: list[int] = Field(description="evidence ids that matter most")
    note: str
    recommends: Literal["contain", "evacuate", "observe"]


class CommanderDecision(BaseModel):
    action: Literal["contain", "evacuate", "observe"]
    confidence: float
    threat_level: int = Field(description="1 (calm) to 5 (catastrophic)")
    priority_sector: str
    rationale: str = Field(description="one line, under 160 characters, citing the deciding evidence")
    countermeasures: list[str] = Field(description="grimoire entry ids to deploy, best first")
    dissent: str = Field(description="where the agents disagreed and how it was resolved")
    escalate: bool = Field(description="post to the incident channel? never for a harmless control tick")
    civilians_plan: str


COMPONENTS = [
    "ThreatHeader", "EMFRadar", "SectorMap", "CountermeasureSelector", "CivilianTracker",
    "TelemetryChart", "EvidenceRail", "GrimoireHits", "ProtocolChecklist", "DecisionCard",
    "DispatchConsole", "StatGrid", "CommsDraft", "ResourceBoard",
]
SOURCES = ["router", "sentinel", "archivist", "verifier", "commander"]
THEMES = ["spectral-goth-dark", "hellfire-red", "ectoplasm-green", "abyssal-blue", "daylight-ops"]

_str = {"type": "string"}
_num = {"type": "number"}
_int = {"type": "integer"}
_bool = {"type": "boolean"}


def _arr(items: dict) -> dict:
    return {"type": "array", "items": items}


def _obj(props: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": props, "required": required or list(props), "additionalProperties": False}


PROPS = {
    "ThreatHeader": _obj({"headline": _str, "severity_tier": _str, "entity": _str, "confidence": _num,
                          "threat_level": _int, "incident_id": _str}),
    "EMFRadar": _obj({"current_value": _num, "status": {"type": "string", "enum": ["nominal", "warning", "danger"]},
                      "refresh_rate_ms": _int, "sector": _str, "trend": _num}),
    "SectorMap": _obj({"layout": {"type": "string", "enum": ["aws_builder_loft", "generic"]},
                       "highlight_sector": _str, "isolated_zones": _arr(_str), "hazard_zones": _arr(_str),
                       "zones": _arr(_obj({"id": _str, "label": _str,
                                           "status": {"type": "string", "enum": ["breached", "hazard", "holding", "clear", "isolated"]}})),
                       "civilians": _arr(_obj({"sector": _str, "count": _int, "status": _str})),
                       "exits": _arr(_str)}),
    "CountermeasureSelector": _obj({"target_entity": _str, "max_select": _int,
                                    "options": _arr(_obj({"id": _str, "label": _str, "efficacy": _num,
                                                          "recommended": _bool, "note": _str}))}),
    "CivilianTracker": _obj({"evac_route": _str, "groups": _arr(_obj({
        "label": _str, "count": _int, "sector": _str,
        "status": {"type": "string", "enum": ["pinned", "sheltering", "evacuating", "safe", "unknown"]}}))}),
    "TelemetryChart": _obj({"series": _arr(_obj({"label": _str, "unit": _str, "values": _arr(_num),
                                                 "danger_threshold": _num}))}),
    "EvidenceRail": _obj({"claims": _arr(_obj({"claim": _str,
                                               "verdict": {"type": "string", "enum": ["confirmed", "contradicted", "unverified"]},
                                               "evidence_ids": _arr(_int)}))}),
    "GrimoireHits": _obj({"entry_ids": _arr(_str), "why": _str}),
    "ProtocolChecklist": _obj({"steps": _arr(_obj({"label": _str, "owner": _str, "critical": _bool}))}),
    "DecisionCard": _obj({"action": {"type": "string", "enum": ["contain", "evacuate", "observe"]},
                          "confidence": _num, "rationale": _str, "dissent": _str}),
    "DispatchConsole": _obj({"channel": _str, "urgency": {"type": "string", "enum": ["flash", "priority", "routine", "hold"]},
                             "headline": _str}),
    "StatGrid": _obj({"stats": _arr(_obj({"label": _str, "value": _str, "unit": _str,
                                         "tone": {"type": "string", "enum": ["danger", "warn", "ok", "info"]}}))}),
    "CommsDraft": _obj({"audience": _str, "message": _str}),
    "ResourceBoard": _obj({"resources": _arr(_obj({"label": _str, "available": _int, "deployed": _int, "unit": _str}))}),
}


def manifest_schema() -> dict:
    variants = []
    for name in COMPONENTS:
        variants.append(_obj({
            "component": {"type": "string", "enum": [name]},
            "title": _str,
            "source": {"type": "string", "enum": SOURCES},
            "why": _str,
            "props": PROPS[name],
        }))
    return _obj({
        "theme": {"type": "string", "enum": THEMES},
        "station_title": _str,
        "threat_level": _int,
        "summary": _str,
        "ui_components_ordered": {"type": "array", "items": {"anyOf": variants}},
    })


CATALOG = """
ThreatHeader      {headline, severity_tier, entity, confidence 0-1, threat_level 1-5, incident_id}  - always first
EMFRadar          {current_value mG, status nominal|warning|danger, refresh_rate_ms, sector, trend}   - only when EMF readings exist
SectorMap         {layout aws_builder_loft|generic, highlight_sector, isolated_zones[], hazard_zones[], zones[{id,label,status}], civilians[{sector,count,status}], exits[]}
                  aws_builder_loft sector ids: entrance, registration, main_stage, catering_coffee_bar, network_closet, lounge, workshop_a, workshop_b, stairwell_west, stairwell_se.
                  For incidents elsewhere use layout generic and invent 4-8 zones that fit (regions, districts, floors, services).
CountermeasureSelector {target_entity, max_select, options[{id (grimoire id), label, efficacy 0-1, recommended, note}]} - operator picks what to deploy
CivilianTracker   {evac_route, groups[{label, count, sector, status pinned|sheltering|evacuating|safe|unknown}]}
TelemetryChart    {series[{label, unit, values[] (6-12 points ending at the current reading), danger_threshold}]}
EvidenceRail      {claims[{claim, verdict confirmed|contradicted|unverified, evidence_ids[] (ids from EVIDENCE)}]}
GrimoireHits      {entry_ids[] (ids from GRIMOIRE), why}
ProtocolChecklist {steps[{label, owner (an agent or human role), critical}]} - 4-7 concrete steps
DecisionCard      {action, confidence, rationale, dissent} - the commander's call
DispatchConsole   {channel, urgency flash|priority|routine|hold, headline} - the operator sends the alert from here
StatGrid          {stats[{label, value, unit, tone danger|warn|ok|info}]} - 3-6 key numbers
CommsDraft        {audience, message} - public announcement draft
ResourceBoard     {resources[{label, available, deployed, unit}]}
"""
