"""The Grimoire: an indexed store of countermeasures, doctrine and real-world playbooks.

Embedded once with Parasail (BGE-M3) and cached on disk; retrieval is cosine similarity.
The Archivist agent is the only one that reads it, which is part of its partial knowledge.
"""
from __future__ import annotations

import hashlib
import json

import numpy as np

from . import config, parasail

ENTRIES: list[dict] = [
    # --- countermeasures (paranormal) ---
    {"id": "salt_line_deployer", "kind": "countermeasure", "title": "Salt-line deployer",
     "applies_to": ["phantom", "spectre", "shade", "revenant"], "efficacy": 0.78, "cost": "low",
     "text": "Lays an unbroken line of coarse salt across thresholds. Phantoms and spectres cannot cross an intact line; buys time to extract pinned civilians. Breaks if walked over."},
    {"id": "uv_lanterns", "kind": "countermeasure", "title": "UV lantern array",
     "applies_to": ["phantom", "spectre", "wraith"], "efficacy": 0.71, "cost": "medium",
     "text": "Ultraviolet flood at 365nm destabilises ectoplasmic manifestations and drops EMF readings. Best against level-4+ phantoms in enclosed sectors such as catering bays."},
    {"id": "cold_iron_perimeter", "kind": "countermeasure", "title": "Cold-iron perimeter",
     "applies_to": ["revenant", "poltergeist", "wraith"], "efficacy": 0.66, "cost": "medium",
     "text": "Iron filings or rebar staked around a sector. Poltergeist kinetic activity collapses inside an iron ring; ineffective against residual echoes."},
    {"id": "faraday_shroud", "kind": "countermeasure", "title": "Faraday shroud",
     "applies_to": ["phantom", "poltergeist"], "efficacy": 0.62, "cost": "high",
     "text": "Conductive mesh dropped over network nodes. Starves entities that feed on electrical fields and protects disrupted network equipment. Use when entities attack local network nodes."},
    {"id": "infrasound_jammer", "kind": "countermeasure", "title": "19Hz infrasound jammer",
     "applies_to": ["banshee", "shade"], "efficacy": 0.58, "cost": "low",
     "text": "Cancels the 19Hz standing wave associated with dread and apparitions. Reduces witness panic; does not banish."},
    {"id": "mirror_trap", "kind": "countermeasure", "title": "Mirror trap",
     "applies_to": ["wraith", "phantom"], "efficacy": 0.55, "cost": "low",
     "text": "Angled mirrors create a recursive corridor that holds a wraith in place long enough for a banishment rite. Requires line of sight."},
    {"id": "banishment_rite", "kind": "countermeasure", "title": "Banishment rite (Ordo Loft)",
     "applies_to": ["phantom", "wraith", "revenant", "spectre"], "efficacy": 0.84, "cost": "high",
     "text": "Full exorcism protocol. Only after civilians are clear of the contact zone; takes 6-8 minutes; high success against level-5 phantoms once contained."},
    {"id": "ectoplasm_vacuum", "kind": "countermeasure", "title": "Ectoplasm vacuum",
     "applies_to": ["poltergeist", "phantom"], "efficacy": 0.6, "cost": "medium",
     "text": "Portable containment unit that captures residue and lowers manifestation confidence. Clean-up after containment."},
    {"id": "spectral_decoy", "kind": "countermeasure", "title": "Spectral decoy beacon",
     "applies_to": ["phantom", "wraith", "banshee"], "efficacy": 0.52, "cost": "low",
     "text": "Emits a warm EMF signature to lure an entity away from pinned civilians toward an isolated zone."},
    {"id": "sage_smudge", "kind": "countermeasure", "title": "Sage smudge sweep",
     "applies_to": ["residual-echo", "shade"], "efficacy": 0.4, "cost": "low",
     "text": "Low-intensity cleansing for residual echoes. Residual echoes are recordings, not agents; they are non-hostile and usually only need observation."},
    # --- entities ---
    {"id": "entity_level5_phantom", "kind": "entity", "title": "Level-5 Phantom",
     "applies_to": ["phantom"], "efficacy": 0, "cost": "",
     "text": "Hostile, mobile, intelligent. Drops ambient temperature below zero and pushes EMF past 90 mG. Pins civilians behind obstacles. Disrupts electrical and network systems. Weak to salt, UV and banishment."},
    {"id": "entity_residual_echo", "kind": "entity", "title": "Residual echo",
     "applies_to": ["residual-echo"], "efficacy": 0, "cost": "",
     "text": "A replaying imprint. Low confidence sightings, single witness, mild EMF (30-50 mG). Non-hostile. Doctrine: observe, do not engage."},
    {"id": "entity_poltergeist", "kind": "entity", "title": "Poltergeist",
     "applies_to": ["poltergeist"], "efficacy": 0, "cost": "",
     "text": "Kinetic entity: high motion events, objects thrown, moderate EMF. Localised to one room. Contain with cold iron."},
    {"id": "entity_human_crowd", "kind": "entity", "title": "Human crowd (not an entity)",
     "applies_to": ["human-crowd"], "efficacy": 0, "cost": "",
     "text": "High motion events with normal EMF (<10 mG) and normal temperature are people, not ghosts. Classic false alarm. Do not escalate; observe."},
    {"id": "entity_wraith", "kind": "entity", "title": "Wraith",
     "applies_to": ["wraith"], "efficacy": 0, "cost": "",
     "text": "Fast, drains warmth, moves between sectors through walls. Mobile threats require evacuation of adjacent sectors."},
    # --- doctrine ---
    {"id": "doctrine_contain", "kind": "doctrine", "title": "Doctrine: CONTAIN",
     "applies_to": ["*"], "efficacy": 0, "cost": "",
     "text": "Contain when the threat is localised, exits are sealable, and no civilian is exposed. Hold perimeter, deny spread."},
    {"id": "doctrine_evacuate", "kind": "doctrine", "title": "Doctrine: EVACUATE",
     "applies_to": ["*"], "efficacy": 0, "cost": "",
     "text": "Evacuate when the threat is mobile, there is structural compromise, or civilians are in the contact zone (pinned, trapped, exposed). Clear floors top-down and confirm empty."},
    {"id": "doctrine_observe", "kind": "doctrine", "title": "Doctrine: OBSERVE",
     "applies_to": ["*"], "efficacy": 0, "cost": "",
     "text": "Observe when origin is unknown, activity is non-hostile, or containment risk exceeds benefit. Maintain distance, record, do not engage. A harmless control tick must never be escalated: that is a false alarm."},
    {"id": "doctrine_false_alarm", "kind": "doctrine", "title": "False-alarm discipline",
     "applies_to": ["*"], "efficacy": 0, "cost": "",
     "text": "Scheduled, logged, single-source events with normal sensor baselines are control ticks. Escalating them costs credibility and is scored as a false alarm."},
    # --- venue ---
    {"id": "venue_loft_layout", "kind": "venue", "title": "AWS Builder Loft, 525 Market St, 2nd floor",
     "applies_to": ["*"], "efficacy": 0, "cost": "",
     "text": "Sectors: entrance and registration on the west wall, main stage north, catering and coffee bar east, workshop rooms south, lounge centre, network closet behind catering. Two stairwell exits: west (entrance) and south-east."},
    # --- real-world playbooks ---
    {"id": "pb_ics", "kind": "playbook", "title": "Incident Command System (ICS) activation",
     "applies_to": ["real_world"], "efficacy": 0.8, "cost": "low",
     "text": "Name an incident commander, set objectives, establish a single command post and a common operating picture. Assign operations, planning, logistics. Communicate on one channel."},
    {"id": "pb_cloud_region_outage", "kind": "playbook", "title": "Cloud region outage runbook",
     "applies_to": ["real_world", "outage"], "efficacy": 0.82, "cost": "medium",
     "text": "Confirm on the provider status page, freeze deploys, fail over to a healthy region, shed non-critical load, post a customer status update every 30 minutes, open a postmortem."},
    {"id": "pb_venue_power_outage", "kind": "playbook", "title": "Venue power outage",
     "applies_to": ["real_world", "outage"], "efficacy": 0.75, "cost": "low",
     "text": "Switch to emergency lighting, keep stairwells clear, do not use elevators, account for every attendee by sector, check life-safety systems, coordinate with building management."},
    {"id": "pb_fire_evacuation", "kind": "playbook", "title": "Fire / smoke evacuation",
     "applies_to": ["real_world", "fire"], "efficacy": 0.88, "cost": "low",
     "text": "Pull the alarm, evacuate via nearest stairwell, never elevators, assemble at the muster point, sweep sectors, report missing persons to fire services."},
    {"id": "pb_crowd_crush", "kind": "playbook", "title": "Crowd density emergency",
     "applies_to": ["real_world", "crowd"], "efficacy": 0.79, "cost": "medium",
     "text": "Stop inflow, open all exits, use calm PA messaging, create relief routes, deploy stewards at choke points; above 5 people per square metre is critical."},
    {"id": "pb_wildfire_smoke", "kind": "playbook", "title": "Wildfire and smoke",
     "applies_to": ["real_world", "fire", "weather"], "efficacy": 0.77, "cost": "medium",
     "text": "Track AQI and evacuation orders, shelter in place with filtered air above AQI 200, pre-stage transport, protect vulnerable groups, follow official evacuation zones."},
    {"id": "pb_earthquake", "kind": "playbook", "title": "Earthquake response",
     "applies_to": ["real_world", "quake"], "efficacy": 0.8, "cost": "low",
     "text": "Drop, cover, hold on. After shaking stops: check injuries, gas leaks and structure, expect aftershocks, evacuate damaged buildings, keep phone lines free."},
    {"id": "pb_cyber_incident", "kind": "playbook", "title": "Cyber incident / ransomware",
     "applies_to": ["real_world", "cyber"], "efficacy": 0.81, "cost": "high",
     "text": "Isolate affected hosts, preserve evidence, rotate credentials, activate backups, notify legal and leadership, communicate without speculation."},
    {"id": "pb_medical", "kind": "playbook", "title": "Medical emergency at an event",
     "applies_to": ["real_world", "medical"], "efficacy": 0.86, "cost": "low",
     "text": "Call emergency services, send someone to fetch the AED, clear space, guide responders from the entrance, keep a log of times."},
    {"id": "pb_comms", "kind": "playbook", "title": "Crisis communications",
     "applies_to": ["real_world", "*"], "efficacy": 0.7, "cost": "low",
     "text": "One voice, verified facts only, say what you know, what you are doing and when the next update comes. Cite sources. Never speculate on causes."},
    {"id": "pb_flood", "kind": "playbook", "title": "Flash flood",
     "applies_to": ["real_world", "weather"], "efficacy": 0.78, "cost": "medium",
     "text": "Move to higher floors, cut power to flooded areas, never drive through water, stage pumps, track river gauges and official warnings."},
]

_CACHE = config.DATA_DIR / "grimoire-embeddings.json"
_matrix: np.ndarray | None = None
_ids: list[str] = []
BY_ID = {e["id"]: e for e in ENTRIES}


def _doc(e: dict) -> str:
    return f"{e['title']}. {e['kind']}. applies to {', '.join(e['applies_to'])}. {e['text']}"


def _digest() -> str:
    return hashlib.sha256((config.PARASAIL_BASE_URL + config.MODEL_EMBED + json.dumps(ENTRIES, sort_keys=True)).encode()).hexdigest()[:16]


async def build() -> int:
    """Embed every entry once (cached on disk by content hash)."""
    global _matrix, _ids
    digest = _digest()
    if _CACHE.exists():
        cached = json.loads(_CACHE.read_text())
        if cached.get("digest") == digest:
            _ids = cached["ids"]
            _matrix = np.array(cached["vectors"], dtype=np.float32)
            return len(_ids)
    vectors = await parasail.embed([_doc(e) for e in ENTRIES])
    _ids = [e["id"] for e in ENTRIES]
    _matrix = np.array(vectors, dtype=np.float32)
    _CACHE.write_text(json.dumps({"digest": digest, "ids": _ids, "vectors": _matrix.tolist()}))
    return len(_ids)


def ready() -> bool:
    return _matrix is not None


async def search(query: str, k: int = 5, kinds: tuple[str, ...] | None = None) -> list[dict]:
    if _matrix is None:
        await build()
    q = np.array((await parasail.embed([query]))[0], dtype=np.float32)
    m = _matrix
    sims = (m @ q) / (np.linalg.norm(m, axis=1) * np.linalg.norm(q) + 1e-9)
    order = np.argsort(-sims)
    out = []
    for idx in order:
        e = BY_ID[_ids[idx]]
        if kinds and e["kind"] not in kinds:
            continue
        out.append({**e, "similarity": round(float(sims[idx]), 4)})
        if len(out) >= k:
            break
    return out
