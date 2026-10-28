"""Runtime configuration, read once from the environment (and .env)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=False)

DATA_DIR = ROOT / ".wraith"
DATA_DIR.mkdir(exist_ok=True)
FIXTURES = Path(__file__).resolve().parent / "fixtures"


def env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


YDC_API_KEY = env("YDC_API_KEY")
PARASAIL_API_KEY = env("PARASAIL_API_KEY")
ONE_SECRET = env("ONE_SECRET") or env("ONE_API_KEY")
TEAM_HANDLE = env("TEAM_HANDLE")
TEAM_TOKEN = env("TEAM_TOKEN")
DISCORD_CHANNEL_ID = env("DISCORD_CHANNEL_ID", "1564842098740695100")
SCENARIO_MCP = env("SCENARIO_MCP", "https://api.you.com/mcp/halloween-hack-26")

PARASAIL_BASE_URL = env("PARASAIL_BASE_URL", "https://api.parasail.io/v1")
# Model routing: a fast brain for the swarm, a frontier model for the commander,
# a streaming model for the interface compiler, and an embedding model for the grimoire.
MODEL_ROUTER = env("WRAITH_MODEL_ROUTER", "parasail-gpt-oss-120b-fast")
MODEL_SWARM = env("WRAITH_MODEL_SWARM", "parasail-deepseek-v41-flash")
MODEL_VERIFIER = env("WRAITH_MODEL_VERIFIER", "parasail-deepseek-v41-flash")
MODEL_COMMANDER = env("WRAITH_MODEL_COMMANDER", "parasail-deepseek-v41-flash")
MODEL_COMPILER = env("WRAITH_MODEL_COMPILER", "parasail-deepseek-v41-flash")
MODEL_EMBED = env("WRAITH_MODEL_EMBED", "parasail-bge-m3")

# Scouts and the compiler run with reasoning off (≈1 s schema-locked answers); the Commander keeps it on.
FAST_MODE = env("WRAITH_FAST", "1") not in ("0", "false", "no")


def fast_body(model: str) -> dict:
    """Per-model switches that trade hidden reasoning for latency."""
    if not FAST_MODE:
        return {}
    if "deepseek" in model:
        return {"chat_template_kwargs": {"thinking": False}}
    if "gpt-oss" in model:
        return {"reasoning_effort": "low"}
    return {}


PORT = int(env("WRAITH_PORT", "8666"))
DISPATCH_LIVE = env("WRAITH_DISPATCH_LIVE", "1") not in ("0", "false", "no")


def status() -> dict:
    """Which partners are configured (never exposes a key)."""
    return {
        "youcom": bool(YDC_API_KEY),
        "parasail": bool(PARASAIL_API_KEY),
        "one": bool(ONE_SECRET),
        "team": TEAM_HANDLE or None,
        "scenario": SCENARIO_MCP,
        "models": {
            "router": MODEL_ROUTER,
            "swarm": MODEL_SWARM,
            "verifier": MODEL_VERIFIER,
            "commander": MODEL_COMMANDER,
            "compiler": MODEL_COMPILER,
            "embed": MODEL_EMBED,
        },
    }
