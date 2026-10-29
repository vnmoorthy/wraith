# Wraith — 3-minute finalist storyboard

**Before you walk up:** laptop on the projector (1440×900 or larger). Tab 1: the app at `http://localhost:8666` on the idle page (paper, five underlined incidents). Tab 2: the deck at `http://localhost:8666/docs/deck/` (press **F** for fullscreen). Tab 3, safety net: `http://localhost:8666/?replay=02-tick-142`. Run `python -m wraith check` first: everything should be green.

Keys during the demo: **click an underlined incident** to summon · **Space** releases the verdict hold early · **Next tick →** escalates tick 142 → 143 · **← New incident** returns to the idle page · **X-ray** in the header shows the raw stream.

| Time | Screen | What you say | What you do |
|---|---|---|---|
| **0:00–0:06** | App, idle page | "At this venue tonight, the coffee bar hit minus four degrees, and four engineers stopped answering." | Click **a level-5 phantom pinning four engineers in the coffee bar**. |
| **0:06–0:16** | Incident sheet: Read → Gather → Deliberate | "It routes it — haunting. Three agents, each seeing only part of the picture: the instruments, our playbooks on Parasail, the live web on You.com." | Read the votes out as they land: *contain… evacuate… observe.* |
| **0:16–0:26** | **The verdict** (held ~4 s) | "They don't agree. The commander sees only their briefs, and breaks the tie." (beat) "Evacuate." | Silence for one beat when *Evacuate.* lands. Point at *carried / overruled*. |
| **0:26–0:50** | The station writes itself | "None of this existed fifteen seconds ago. Parasail is writing the interface, for this incident, while you watch." | Hands off. Let the camera follow the pen, then pull back. |
| **0:50–1:15** | Operate + Dispatch | "It's a console. Isolate the coffee bar, start the evacuation — the alert rewrites itself — and One acts on it: list, find, execute." | Click the coffee bar on the map → **Dispatch ↓** → **Dispatch** → **Confirm**. Point at One's three steps. |
| **1:15–2:00** | **The Monday turn**: ← New incident → *a checkout outage in us-east-1* | "That's Halloween. Now it's Monday, 9:14, and checkout is down. Is it us, or AWS?" … "A different incident gets a different interface: telemetry at 78× baseline, status-page evidence, a runbook." | **← New incident** → the us-east-1 link. |
| **2:00–2:30** | Deck slide 7 (the fork) | "Same agents, same model. Wildfire smoke: without the live web, it would have moved three hundred people. With You.com it read today's air, and they stayed." | Switch to the deck tab, slide 7. |
| **2:30–3:00** | Deck slide 10 | "Every incident gets its own war room in seconds. Every claim has a receipt. A human presses the button. This is Wraith." | **End** key to slide 10. Stop. |

Optional, only if a judge asks: **X-ray** in the header (the raw JSON stream), **Next tick →** (the station rebuilds as EMF rises 98 → 131), **Autopilot** (Track 1 practice, 3/3, zero false alarms).

## If something breaks on stage

| Symptom | Line | Action |
|---|---|---|
| Parasail slow or busy | "Here's this exact incident from an hour ago — a recording of a real run, labelled replay." | Tab 3 (`?replay=02-tick-142`) |
| Wi-Fi dies | "It runs offline from its own recordings." | **Replays** works without a network |
| One says *Discord not connected* | "One found the action and built the request — it's waiting on the Discord connection." | Point at steps 1 and 2 of the ladder |
| A judge asks "is it hardcoded?" | "Type any incident you like." | **← New incident** → **Real world** → hand them the keyboard |

## Lines worth memorising

- "Every incident is different. Every dashboard is the same."
- "Each agent sees only part of the picture — exactly like a real incident team."
- "None of this existed fifteen seconds ago."
- "Without the live web: evacuate. With You.com: observe."
- "Don't build a dashboard. Compile one."
