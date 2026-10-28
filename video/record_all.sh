#!/usr/bin/env bash
# Records every product clip the video uses (needs the app running on :8666).
set -euo pipefail
cd "$(dirname "$0")/.."
P=.venv/bin/python
B=http://localhost:8666
$P video/record_screen.py "$B/?film=1" video/clips/live142.mp4 --seconds 34 --click "2.5:a level-5 phantom"
$P video/record_screen.py "$B/?replay=02-tick-142&xray=1" video/clips/xray.mp4 --seconds 30
$P video/record_screen.py "$B/?replay=02-tick-142&film=1&dry=1&speed=3" video/clips/operate.mp4 --seconds 24 --click "12:begin evac" --click "14:Dispatch" --click "15.5:Confirm"
$P video/record_screen.py "$B/?replay=06-reality-wildfire&film=1" video/clips/wildfire.mp4 --seconds 24
$P video/record_screen.py "$B/?replay=03-control-900&film=1" video/clips/control.mp4 --seconds 18
