# Submission copy (Google Form: https://forms.gle/2z9dKv9gvsP3cEjW7)

**Project name:** WRAITH — the war room that builds itself

**Track:** Track 2 — The Haunted Dashboard (also plays the Track 1 scenario feed on autopilot)

**One-liner:** Don't build a dashboard — compile one. A CrewAI swarm with partial knowledge reads any incident, verifies it against the live web with You.com, and Parasail streams a bespoke, operable command station into existence component by component; One dispatches the alert to Discord.

**Repo:** https://github.com/vnmoorthy/wraith

**Live demo (hosted replay viewer of real runs):** https://vnmoorthy.github.io/wraith/app/

**Pitch deck:** https://vnmoorthy.github.io/wraith/deck/ (PowerPoint: `docs/WRAITH-deck.pptx` in the repo)

**Run it:** `git clone https://github.com/vnmoorthy/wraith && cd wraith && cp .env.example .env && ./run.sh`

**Description (≈150 words):**
Incidents are unstructured and every one is different, but the dashboards operators get are static. WRAITH treats the interface as the output of an agent swarm. A CrewAI Flow routes each incident (haunting, real-world or harmless control) with a schema-locked Parasail call. Three agents with deliberately partial knowledge gather intel in parallel: a Sentinel scoring instruments, an Archivist retrieving countermeasures and playbooks from a BGE-M3 vector index plus the venue oracle, and a Verifier grounding claims with You.com search highlights and page contents. A Commander that sees only their briefs resolves their disagreements under doctrine. Parasail then streams a JSON-schema-locked UI manifest over a WebSocket and the browser materialises each component the moment its props arrive. The station is operable — isolate sectors, arm countermeasures, evacuate civilians — and the dispatch payload is rebuilt from that state and sent through One's list → find → execute loop. The same swarm plays the Track 1 feed and refuses to escalate the control tick.

**How each partner is load-bearing:**
- **Parasail:** router (gpt-oss-120b-fast), agents + Commander + streaming interface compiler (DeepSeek V4.1 flash, json_schema), BGE-M3 embeddings for the grimoire. Ablate it → no station.
- **CrewAI:** Flow with @start/@router/@listen, partial-knowledge Agents (kickoff_async with typed briefs), live token events. Ablate it → one generic layout, no routing or decision.
- **You.com:** /v1/search with highlights extraction + /v1/contents; every claim gets a clickable source and the evidence changes decisions (e.g. "live AQI is 20–52, smoke reports are from 2023 → observe"). Ablate it → evidence rail empty, severity unverified.
- **One:** list_one_integrations → find_one_actions ("send a message to a channel") → execute_one_action on Discord #loft-incident with a payload built from runtime state. Ablate it → the station can see but not act.
