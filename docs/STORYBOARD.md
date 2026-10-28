# Wraith — 3-minute finalist storyboard

**Before you walk up:** laptop on the projector (1440×900 or larger). Tab 1: the app at `http://localhost:8666` on the idle page (paper, five underlined incidents). Tab 2: the deck at `http://localhost:8666/docs/deck/` (press **F** for fullscreen). Tab 3, safety net: `http://localhost:8666/?replay=02-tick-142`. Run `python -m wraith check` first: everything should be green.

Keys during the demo: **click an underlined incident** to summon · **Space** releases the verdict hold early · **Next tick →** escalates tick 142 → 143 · **← New incident** returns to the idle page · **X-ray** in the header shows the raw stream.

| Time | Screen | What you say | What you do |
|---|---|---|---|
| **0:00–0:08** | App, idle page | "At this venue tonight, the coffee bar hit minus four degrees, and four engineers stopped answering." | Click **a level-5 phantom pinning four engineers in the coffee bar**. |
| **0:08–0:30** | The incident sheet: Read → Gather → Deliberate | "A CrewAI flow reads it and routes it — haunting. Three agents go to work, and each one sees only part of the picture. The Sentinel reads the instruments. The Archivist searches our playbooks with Parasail embeddings. The Verifier checks the live web with You.com — is it just a cold night? A power cut?" | Point at the three columns as they type. Point at the You.com queries under the Verifier. |
| **0:30–0:45** | **The verdict** | "Contain. Evacuate. Observe. They disagree. The commander only sees their briefs — and it breaks the tie." (pause) "Evacuate." | Stay silent for one beat when *Evacuate.* lands. Point at *carried* / *overruled*. |
| **0:45–1:10** | The station writes itself | "None of this existed fifteen seconds ago. Parasail is writing the interface — every section chosen, ordered and filled by the model, for this incident, while you watch." | Let the camera follow the pen. Toggle **X-ray** for three seconds to show the JSON arriving, then off. |
| **1:10–1:30** | Operate + Dispatch | "It's a console, not a picture. Start the evacuation — the alert rewrites itself — and One sends it, step by step: list, find, execute." | Click **begin evac** → **Dispatch ↓** → **Dispatch** → **Confirm**. Point at One's three-step ladder. |
| **1:30–1:40** | Next tick | "And when it gets worse — EMF from ninety-eight to one-thirty-one — the war room rebuilds itself." | Click **Next tick →** (optional if time is short). |
| **1:40–2:20** | **The Monday turn**: ← New incident → Real world → *Is it us or AWS?* | "That's Halloween. Now it's Monday, 9:14, and checkout is down. Is it us, or is it AWS?" … "Different incident, different branch, a different interface: telemetry, status-page evidence, a failover runbook." | **← New incident** → the *a checkout outage in us-east-1* link. Narrate the Sentinel reading 5xx at 78× baseline. |
| **2:20–2:40** | Replays → wildfire, or slide 7 | "And here's what the live web is worth. Wildfire smoke over the Bay. Without You.com, the commander would have moved three hundred people. With today's air quality, it said observe." | **Replays** → *wildfire* at 2×, or the deck. |
| **2:40–3:00** | Deck slide 10 | "We picked this idea by running a hundred AI judges against ten ideas — then two hundred more red-teamed the product. Open source, one command. Wraith: the war room that builds itself." | End on slide 10. |

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
