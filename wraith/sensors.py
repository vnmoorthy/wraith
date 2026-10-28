"""Sentinel's instrument: score raw sensor readings against the venue's baseline.

Pure arithmetic, no model. The Sentinel agent reads these numbers and only these.
"""
from __future__ import annotations

BASELINE = {
    "emf_milligauss": (6.0, 8.0),   # mean, spread for an occupied event floor
    "temp_c": (21.0, 2.5),
    "motion_events": (12.0, 14.0),
}


def score_sector(report: dict, previous: dict | None = None) -> dict:
    s = report.get("sensors") or {}
    z = {}
    for k, (mu, sd) in BASELINE.items():
        if k in s and s[k] is not None:
            z[k] = round((float(s[k]) - mu) / sd, 2)
    emf_z = max(0.0, z.get("emf_milligauss", 0.0))
    cold_z = max(0.0, -z.get("temp_c", 0.0))
    motion_z = max(0.0, z.get("motion_events", 0.0))
    # Paranormal signatures are EMF + cold together; motion alone is just people.
    signature = min(1.0, (emf_z * 0.09 + cold_z * 0.12) * (1.0 if emf_z > 2 and cold_z > 2 else 0.55))
    trend = None
    if previous and previous.get("sensors"):
        pe = previous["sensors"].get("emf_milligauss")
        ce = s.get("emf_milligauss")
        if pe is not None and ce is not None:
            trend = round(float(ce) - float(pe), 1)
    sighting = report.get("sighting") or {}
    verdict = "anomalous" if signature >= 0.6 else "elevated" if signature >= 0.25 else "baseline"
    if motion_z > 1.5 and signature < 0.25:
        verdict = "crowd-like (motion without EMF/cold)"
    return {
        "sector": report.get("sector"),
        "readings": s,
        "z_scores": z,
        "signature_score": round(signature, 3),
        "emf_trend": trend,
        "verdict": verdict,
        "sighting_confidence": sighting.get("confidence"),
    }


def readings_from_text(text: str) -> dict:
    """Pull instrument readings out of a free-text incident log (EMF mG, temperature °C, motion events)."""
    import re
    out: dict = {}
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:milligauss|mG)\b", text, re.I) or re.search(r"EMF[^\d-]{0,30}(-?\d+(?:\.\d+)?)", text, re.I)
    if m:
        out["emf_milligauss"] = float(m.group(1))
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*°?\s*C\b", text)
    if m:
        out["temp_c"] = float(m.group(1))
    m = re.search(r"(\d+)\s*motion", text, re.I)
    if m:
        out["motion_events"] = float(m.group(1))
    return out


def series_from_text(text: str) -> list[dict]:
    """Pull comma-separated metric series out of an alert, e.g. `5xx_rate_pct 0.3,0.2,11.8,23.5`."""
    import re
    out = []
    for m in re.finditer(r"(\b[A-Za-z0-9][\w%.-]{1,30})[ :=]+((?:-?\d+(?:\.\d+)?\s*,\s*){3,}-?\d+(?:\.\d+)?)", text):
        values = [float(v) for v in re.split(r"\s*,\s*", m.group(2))]
        base = sum(values[: max(1, len(values) // 2)]) / max(1, len(values) // 2)
        out.append({"metric": m.group(1), "values": values, "baseline": round(base, 2), "latest": values[-1],
                    "x_baseline": round(values[-1] / base, 1) if base else None})
    return out[:4]


def score_tick(tick: dict, previous_tick: dict | None = None) -> list[dict]:
    prev = {r.get("sector"): r for r in (previous_tick or {}).get("sector_reports", [])}
    return [score_sector(r, prev.get(r.get("sector"))) for r in tick.get("sector_reports", [])]
