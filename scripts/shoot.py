"""Re-shoot the README and deck screenshots from recorded runs (needs the app on :8666)."""
import subprocess
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
IMG = Path(__file__).resolve().parent.parent / "docs" / "img"
SHOTS = [
    ("verdict", 17000, "?replay=06-reality-wildfire&hold=30000"),
    ("sheet", 8500, "?replay=02-tick-142&hold=30000"),
    ("station-haunting", 40000, "?replay=02-tick-142&speed=2"),
    ("station-reality", 40000, "?replay=05-reality-us-east-1&speed=2"),
    ("idle", 6000, ""),
    ("run-01-haunted-dashboard", 40000, "?replay=01-haunted-dashboard&speed=2"),
    ("run-03-control-900", 30000, "?replay=03-control-900&speed=2"),
    ("run-05-reality-us-east-1", 40000, "?replay=05-reality-us-east-1&speed=2"),
    ("run-06-reality-wildfire", 40000, "?replay=06-reality-wildfire&speed=2"),
]
for name, budget, query in SHOTS:
    png = IMG / f"{name}.png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--virtual-time-budget={budget}",
                    f"--screenshot={png}", "--window-size=1600,1000", f"http://localhost:8666/{query}"], capture_output=True)
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "86", str(png), "--out", str(png.with_suffix(".jpg"))],
                   capture_output=True, check=True)
    png.unlink()
    print(name)
