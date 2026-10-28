# WRAITH — 3-minute finalist storyboard

**Setup before you walk up:** laptop on the projector at 1440×900 or larger. Tab 1: the deck (`http://localhost:8666/docs/deck/`, press **F** for fullscreen). Tab 2: the app (`http://localhost:8666`). Discord `#loft-incident` open on your phone. In the app: **X-ray on**, **Provenance off**, Venue feed → `spooky-2026-9912` selected. Have one finished run in **Replays** as a safety net.

| Time | Slide / screen | What you say (≈ 430 words total) | What you do |
|---|---|---|---|
| **0:00–0:15** | **Slide 1** — WRAITH title (runes spin, letters materialise) | "Every incident is different. Every dashboard is the same. This is WRAITH — the war room that builds itself." | Let the title animate. Pause one beat after "builds itself." |
| **0:15–0:35** | **Slide 2** → **Slide 3** (JSON streams on the left, components snap in on the right) | "When something goes wrong, you get a static dashboard built months ago for a different crisis. So we stopped building dashboards. WRAITH *compiles* one — for this incident, while the model is still thinking." | Advance to slide 3 and let the stream play ~6 s. |
| **0:35–0:50** | **Slide 4** — the pipeline (packet travels the snake path) | "A CrewAI Flow routes the incident. Three agents gather intel with partial knowledge. A Commander who only sees their briefs decides. Then Parasail streams a schema-locked interface over a WebSocket, and One acts on it." | Point at the packet as it reaches *Compiler* and *One*. |
| **0:50–1:45** | **Switch to the app — LIVE** | "Here's the venue's own incident log." (click **SUMMON WAR ROOM**) "The router picked the *haunting* branch. Watch the swarm: the Sentinel only sees instruments — EMF 98, minus four degrees. The Archivist only sees the grimoire, retrieved by Parasail embeddings. The Verifier only sees the live web: You.com is checking whether there's a real power outage or a cold snap on Market Street — there isn't, so the mundane explanation is ruled out." … "Now the interface compiles — every panel you see was chosen and ordered by the model. Here's the raw JSON arriving on the right." | Click summon. Narrate the lanes as they light up. When the first component appears, gesture at **X-ray**. Toggle **Provenance** once: "each panel is coloured by the agent that built it." |
| **1:45–2:15** | **App — operate it** | "It isn't a picture, it's a console. I'll isolate the main stage, arm salt lines and UV lanterns, start the evacuation of the four engineers pinned at the coffee bar — and the dispatch payload is rebuilding from what I just did." … "Dispatch." | Click the **main stage** sector, tick two countermeasures, click **begin evac**, scroll to Dispatch → **DISPATCH** → **CONFIRM DISPATCH**. Hold up the phone as `#loft-incident` pings. Point at the **receipt** (message id). |
| **2:15–2:35** | **App — reality mode** (or slide 7 if time is tight) | "Halloween is the demo. Incidents are the market. Same engine, a real one:" (paste *AWS us-east-1* preset) "— different branch, no ghost radar, a zone map, status-page evidence, a failover runbook. Different incident, different interface." | Reality mode → preset **AWS us-east-1** → Summon. Talk over the swarm; you only need the first 3–4 components on screen. |
| **2:35–2:50** | **Slide 6** (cards flip to *ablated*) → **Slide 8** | "Every partner is load-bearing — switch one off and the station visibly breaks. And the same swarm plays the Track 1 feed: evacuate, evacuate, and it *refuses* to escalate the human-crowd control tick. Zero false alarms." | Quick: slide 6, then slide 8. |
| **2:50–3:00** | **Slide 10** — 100 judges, 100 first-place votes | "We picked this idea by running a hundred AI judges against ten ideas — it won all hundred first-place votes. It's open source, one command to run. WRAITH: the war room that builds itself." | Stop on slide 10. Smile. |

## If something breaks on stage

| Symptom | Recovery line | Action |
|---|---|---|
| Parasail is slow / 429 | "The rate governor is backing off — here's this exact run from an hour ago, labelled replay." | **Replays** → pick the haunting run → 2× |
| Venue Wi-Fi dies | "It runs offline from its own recordings." | **Replays** works with no network |
| Discord post fails | "One returned the error and the station shows it — here's the dry-run request One built." | Tick **dry run**, dispatch again, show the request |
| A judge asks "is it hardcoded?" | "Type any incident you like." | Hand them the keyboard in **Reality mode** |

## 10-minute extended demo (for judge Q&A or a booth)

1. **0–1 min** — Slide 1–4 (the why and the how).
2. **1–3 min** — Venue fixture `spooky-2026-9912`, narrate the swarm lanes (knows / blind chips), X-ray, provenance.
3. **3–4 min** — Operate the station: isolate sectors, arm countermeasures, evacuate civilians, tick the protocol, dispatch with receipt.
4. **4–5 min** — Tick **900 (control)**: the router takes the `control` branch, the Verifier is not consulted, the Commander says *observe*, the station is calm and the Dispatch Console says **hold**. "This is what not having false alarms looks like."
5. **5–6.5 min** — **Ablation**: click *You.com* off in the header → summon tick 142 → the evidence rail is empty and severity is "unverified". Click *One* off → Dispatch says **ONE OFFLINE**. Click *CrewAI* off → one generic layout, no routing. Turn them back on.
6. **6.5–8 min** — **Reality mode**: AWS us-east-1, then let a judge type their own incident.
7. **8–9 min** — **Autopilot**: Practice run (3/3, zero false alarms), then show the live scoreboard row for our team.
8. **9–10 min** — **Replays** (offline, labelled), the README architecture diagram, `./run.sh`, questions.

## Lines worth memorising

- "Don't build a dashboard. Compile one."
- "No agent sees everything — exactly like a real incident team."
- "Every panel you see was chosen, ordered and filled by the model for *this* incident."
- "Switch a partner off and the station breaks. That's how you know it's load-bearing."
- "A hundred judges, a hundred first-place votes."
