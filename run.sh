#!/usr/bin/env bash
# One command: ./run.sh   → installs what is missing, builds the UI, checks partners, serves on :8666
set -euo pipefail
cd "$(dirname "$0")"

PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null && "$c" -c 'import sys; exit(0 if (3,10)<=sys.version_info[:2]<(3,14) else 1)'; then PY="$c"; break; fi
done
[ -n "$PY" ] || { echo "Python 3.10–3.13 is required (CrewAI does not support 3.14)"; exit 1; }

[ -f .env ] || { cp .env.example .env; echo "→ created .env from .env.example — fill in your keys, then run ./run.sh again"; }

if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null; then uv venv --python "$PY" .venv; else "$PY" -m venv .venv; fi
fi
if ! .venv/bin/python -c 'import crewai, fastapi' 2>/dev/null; then
  if command -v uv >/dev/null; then uv pip install --python .venv/bin/python -r requirements.txt; else .venv/bin/pip install -r requirements.txt; fi
fi

if ! command -v one >/dev/null; then
  echo "→ installing the One CLI (needs Node 22.23.4+ / 24.22.1+)"; npm i -g @withone/cli || echo "  (One CLI install failed: Dispatch will be unavailable)"
fi

if [ ! -f wraith/static/index.html ] || [ "${REBUILD:-0}" = "1" ]; then
  (cd web && npm install --silent && npx vite build)
fi

echo "→ partner check"; .venv/bin/python -m wraith check || echo "  (some partners are not configured yet — replays still work offline)"
exec .venv/bin/python -m wraith
