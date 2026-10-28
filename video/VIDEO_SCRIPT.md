# WRAITH — product video script (≈ 2 minutes)

**How to record (10 minutes, phone or laptop camera):**
1. Frame yourself from the chest up, face a window or a lamp, plain background. Landscape. Look at the lens.
2. Record **each numbered line below as its own clip**. Pause one breath before and after. Re-take freely; keep the best.
3. Name them `01.mov`, `02.mov`, … `10.mov` and drop them in `video/takes/`. (Any of .mov / .mp4 / .m4a works.)
4. Run `python video/build_video.py` — it cuts the video for you: lines **01, 09, 10** are full-frame you; lines **02–08** play the product with you in a small circle in the corner, retimed to your pace.

Speak like you are telling one smart friend. Slower than feels natural. Smile on 01 and 10.

---

**01 — on camera** *(caption: Every incident is different)*
> Every incident is different. But the dashboard you get at three in the morning was built months ago, for somebody else's crisis.

**02 — over the product: the idle page, then a real incident is summoned**
> So we built Wraith. You describe what's happening, and the war room builds itself.

**03 — over the product: three agents writing their briefs**
> A CrewAI flow reads the incident and routes it. Then three agents go to work, and each one only sees part of the picture. One reads the instruments. One searches our playbooks with Parasail embeddings. One checks the live web with You.com.

**04 — over the product: "Evacuate." lands**
> They disagree. Contain. Evacuate. Observe. The commander only sees their briefs, and it breaks the tie: evacuate. Four people are pinned in the contact zone.

**05 — over the product: the station assembles, raw JSON streaming on the right**
> And then — this is the part I love — Parasail streams the interface itself. Every panel you see was chosen, ordered and filled by the model, for this incident, while you watch.

**06 — over the product: start the evacuation, press Dispatch, One's three steps**
> It's not a picture, it's a console. Start the evacuation, and the alert rewrites itself. One sends it to the team's Discord, step by step.

**07 — over the product: wildfire smoke, the counterfactual line**
> Try a real one. Wildfire smoke over the Bay. Without the live web, the commander would have evacuated three hundred people. With You.com, it saw today's air quality, and said observe.

**08 — over the product: the calm green control station**
> And when it's just a crowd of people, it knows. No panic. Zero false alarms.

**09 — on camera** *(caption: Incidents are the market)*
> Halloween is the demo. Incidents are the market: on-call engineers, venues, emergency teams. Any incident, its own war room, in about fifteen seconds.

**10 — on camera** *(caption: github.com/vnmoorthy/wraith)*
> We picked this idea by running a hundred AI judges against ten ideas. It won all hundred votes. Then two hundred more agents red-teamed the product. It's open source. This is Wraith, the war room that builds itself.

---

Everything on screen in lines 02–08 is a real run: 02–04 is recorded live from the app; 05–08 are replays of recorded live runs (the app labels them "Replay · recorded run").
