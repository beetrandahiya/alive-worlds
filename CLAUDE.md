# Painted Worlds — project log

This file is the single source of truth for the project. Any session (including
parallel ones for other paintings) must read it first and keep it current.
Do not re-ask the owner anything recorded here.

## Vision

A VR experience where you step into famous paintings and walk inside worlds
*made of paint* — not 3D models with a filter. Eventually: a quiet museum hall;
walk up to a painting, step through the frame into its world. Each world is
built the way that artist painted (Van Gogh impasto, Leonardo sfumato, Monet
dabs of light; Hokusai, Turner later).

**Current scope: one world only — The Starry Night.** Design so others can
follow; do not build for them yet. No museum yet.

## Owner's standing rules

- Quality bar: Apple-level polish, nothing that feels like a tech demo.
  "Good enough" is not done.
- Copy the real reference, invent nothing. Reference = the real high-res
  public-domain painting (Google Art Project scan of the MoMA canvas, on
  Wikimedia Commons). Gaps are filled only from Van Gogh's other Saint-Rémy
  period works. Study Loving Vincent and painterly-rendering research.
- Everything is judged in the headset by the owner, never from a mockup.
- The owner makes every taste decision. If the painting doesn't decide it, ask.
- Free only: no paid services, APIs, subscriptions, or assets.
- Be honest: say when something is a bad idea, broken, untested, or slow.
  Report Quest frame rate plainly.
- After each step: say what changed, what to look at in the headset, and what
  opinion is wanted.
- Explain technology in plain words.

## Hardware

- Meta Quest 3, standalone — the target. Developer mode is on.
- Windows PC (RTX 4070 Ti, i7-12700K, 32 GB) with Link cable — ignored for now.
- MacBook Air (M5) — where the owner works.
- Free GitHub account; repo `beetrandahiya/alive-worlds` is public.
- Play space: small, about 1.5 x 1.5 m. Used standing and walking.

## Decisions from the interview (2026-11-13)

### Seeing and feeling
- Start at the painting's viewpoint: hillside beside the cypress, composition
  matches the painting.
- Mood: quiet awe. Still, contemplative, a night you could stay in for an hour.
- Scale: real-world (real valley, 15 m cypress, village several minutes' walk).
- Must be able to: walk the village streets, stand under the cypress, watch the
  sky for a long time, climb the hills.

### Faithfulness and the paint
- Paint up close = thick physical strokes with raised impasto that catches
  light, laid over solid forms.
- Stroke scale: "repainted at human scale". From the viewpoint it matches the
  painting's big strokes; as you approach, forms resolve into more, smaller
  strokes (hand-to-arm sized near you), as if he set up his easel where you stand.
- Unseen parts come only from his other Saint-Rémy works.
- Inhabitants: no people. Small signs of life: a bird crossing the sky, a cat in
  the village (slips away if approached), fireflies in the fields. (Moths: no.)
- Colour: DECIDED in headset 2026-11-14 — the canvas as it hangs today. Not
  the deeper-night version ("dark gritty").
- Gaps between strokes: DECIDED in headset 2026-11-14 — soft colour from the
  painting. Bare-canvas flecks were tried and rejected: "they take away the
  illusion of being inside the world of Van Gogh". Do not show raw canvas
  inside the world. (Lesson: fidelity to the canvas as an object loses to
  fidelity to the world it depicts.)
- Paint amount: DECIDED in headset 2026-11-14 — always full. Medium and light
  did not look good; never thin the strokes to save frame rate.

### Aliveness
- Sky: strokes flow slowly along the painted swirl; composition stays put.
  Speed set in headset 2026-11-14: 70% of the first study (`uFlow` 0.7).
- No hand-painted flicker. Smooth motion everywhere.
- Wind: slow breathing sway (cypress, grass, wheat). Cypress sway confirmed
  right in headset 2026-11-14.
- Time: eternal night with small variations (windows going dark/lighting,
  shooting star, a gust, moon halo pulsing). No day, no cycle.

### Sound
- No music.
- Wind and the cypress (louder near it), night nature (crickets, owl/nightingale,
  frogs), own footsteps varying by ground. No village-life sounds.
- Sky: a barely-there low hum, slightly stronger when looking up.
- No paint sounds.

### Movement, edges, entering, leaving
- Thumbstick smooth walking with a brisker stride at full push, plus room-scale
  physical walking.
- Fast travel: both point-and-blink hops and named places (viewpoint, cypress,
  village square, church, hilltop).
- World edge: wraps around (walk far enough and you arrive on the other side).
- Enter: start in a small dark room with the framed real painting; walk through
  the frame to the viewpoint. (This piece later plugs into the museum.)
- Leave: the frame stays standing at the viewpoint; walk back through. A menu
  item returns you to it from anywhere.

### Comfort and controls
- Owner has no VR sickness. Comfort aids exist but are off by default.
- Turning default: smooth turn (snap available in settings).
- Controllers only, with hands rendered as painted brushwork.
- Touch: soft response — grass/wheat bend from hands and legs, cypress strokes
  stir. Nothing can be damaged or smeared.
- Menu: a small painted card above the left hand (sketchbook-page feel): travel
  places, comfort options, leave. Nothing on screen otherwise.

### Practical
- Delivery: web link opened in the Quest browser (WebXR), hosted on GitHub
  Pages. Switch to an installed app only if the proof test can't hold frame rate.
- Frame rate target: locked 72 fps on standalone Quest 3, budget spent on
  richer paint.
- PC/Link version: not now.
- Publishing: owner allowed merging each test version into `main`; a push to
  `main` publishes to GitHub Pages (Settings → Pages → Source is GitHub Actions).
- The painted composition spans about 65° of your view at the viewpoint
  (natural view, not monumental).
- Sky beyond the painting's frame: the same sky continues all round — same
  blues, a few more stars copied from the painting's own. No second swirl or moon.
- The join between the painted sky and the continued sky must be coherent
  (owner, 2026-11-14, after seeing a visible seam): the painting's currents and
  its bands of light and dark carry on past the frame and settle gradually.
  A fan of strokes rising from the horizon is fine.
- Owner asked (2026-11-13) that published studies of Van Gogh's brushwork and
  of this painting inform the stroke model. Done 2026-11-14: see Research.

## Technology (chosen by Claude, approved by owner 2026-11-13)

- WebXR in the Quest browser; three.js (WebGL2) + TypeScript + Vite; deployed to
  GitHub Pages by a GitHub Actions workflow.
- The world is built from brush strokes anchored in the 3D world (Meier 1996,
  "Painterly Rendering for Animation"), not a screen filter — screen filters
  give each eye different strokes and swim when the head moves.
- Strokes: instanced, hard-edged cutouts (not soft blending) over an opaque
  painted undercoat; relief from a height texture (Hertzmann 2002, "Fast Paint
  Texture"); coarse-to-fine stroke layers that fade in with distance
  (Hertzmann 1998).
- An offline tool analyses the real scan (colour, stroke direction, stroke size)
  to place sky strokes and derive the flow field they move along.
- No full-screen post effects, no real-time shadows: light is painted in, as in
  the painting. Glow = halo strokes, as he painted it.

## How to test (owner)

Link: https://prakrisht.me/alive-worlds/ (the github.io address redirects there) — open in the Quest browser,
press "Step inside". The build label at the bottom of the page and on the wrist
readout (commit + time) confirms which version is loaded; reload if it is old.

Study controls: left stick walk, right stick turn, X = hide wrist readout,
Y = show the what-to-test list above the left hand (also on the landing page;
the list lives in `src/ui/testcard.ts` — update it for each study).
On a computer: drag to look, W A S D to walk.
URL options: `?res=1.2` sharper (costs frame rate), `?fov=0..1` edge blur
(default 0.5).

## Code map

- `tools/starry/lift_strokes.py` — lifts real strokes from the scan into the
  stroke atlas `public/starry/strokes.png` (replaces `make_strokes.py`).
- `tools/starry/analyse.py` — measures the scan (stroke direction, flow sense,
  colour, palettes) and bakes `public/starry/*`. Re-run after changing it
  (needs numpy, scipy, opencv).
- `src/paint/` — the paint itself, shared by every world: `shaders.ts`
  (undercoat, sky strokes, surface strokes), `strokes.ts` (builders, shared
  uniforms, seeded random).
- `src/worlds/starry/` — this world: `sky.ts`, `cypress.ts`, `ground.ts`,
  `terrain.ts`. A new painting gets its own folder here and its own tools.
- `src/xr/rig.ts` movement; `src/ui/wrist.ts` study readout; `src/main.ts` boot.
- Off-headset check: `?shot=painting` renders the exact painting view as a
  still (used with headless Chromium to compare against the scan).

## Status

- [x] Interview complete, decisions logged.
- [x] Plan approved by owner (2026-11-13).
- [x] Step 0: project skeleton + deploy pipeline.
- [x] Step 1: proof of look — PASSED in headset 2026-11-14 (build 077130e).
      Owner: "breathtaking", sky "amazing", cypress "beautiful", up close "so
      good", frame rate stable at full paint (exact wrist number not yet
      reported). Hills and village are still a flat backdrop at infinity.
      Follow-up answers: 72 fps steady at full paint; no shimmer anywhere;
      sharp enough at default resolution; continued sky "seamless and right"
      (corner creases not noticed); sizes of cypress, sky and village all felt
      right. Measured budget so far: ~42k moving sky strokes + ~58k static
      backdrop strokes + ~21k cypress + ~50k ground at 72 fps, default
      resolution, edge blur 0.5.
- [x] Study 02 (2026-11-14): sky at 70% speed confirmed good; 72 fps stable;
      canvas flecks rejected and removed.
- [ ] Step 2: terrain and composition matched from the viewpoint.
- [ ] Step 3: village and church, windows.
- [ ] Step 4: human-scale repaint everywhere, full locomotion, fast travel, wrap.
- [ ] Step 5: life — wind, fireflies, bird, cat, touch response, small events.
- [ ] Step 6: sound.
- [ ] Step 7: entry room and frame, painted hands, menu card, settings.
- [ ] Step 8: polish and performance passes.

## Research (2026-11-14)

What published sources add to what the scan shows. Items marked (unverified)
were recalled by the researcher, not read on a page.

- Stroke sizes on this canvas (Ma et al. 2024, Physics of Fluids 36, 095140,
  arxiv.org/abs/2310.03415, measured on the Google scan): width 0.09-1.5 cm,
  length 1.2-6 cm, median 3.6 cm. At our 65 degree view 1 cm of canvas is about
  0.71 degrees, so the median stroke is about 2.5 degrees long. Our sky strokes
  (1.8-3.7 degrees long, 0.45-0.78 wide) sit inside that range, slightly long.
- The sky's 14 eddies are 4.2-27.6 cm across (3-19.5 degrees), and its
  brightness follows turbulence scaling (Kolmogorov -5/3 over 4.3-15 cm). Use
  these sizes if eddies are ever added to the continued sky.
- What marks his strokes statistically (Li, Yao, Hendriks, Wang 2012, TPAMI):
  many tightly packed, regular, elongated, straight strokes. Exact numbers
  not obtained (paywalled).
- Order of painting: stars were painted last, over everything else (Naifeh &
  Smith 2011; biography, not a technical study). We draw star dabs on top.
- Pigments (Zhao, Berns et al. 2008, spectral imaging): ultramarine in the
  deep sky, cobalt blue in the bright swirls and round the moon, emerald
  green round the moon, Indian and zinc yellow in moon and stars, burnt umber
  in the cypress branches.
- Colour change since 1889: no source found for this painting. Nothing
  supports any particular "original" look. (Owner chose the canvas as it hangs.)
- Impasto height in mm: no published figure found. His "Cypresses" (Met) has
  sand and pebbles up to 6 mm in the paint; letter 783: cypress foregrounds
  "painted very thick".
- Real vs imagined: view is from the east-facing asylum window; the Alpilles
  are real; the village was not visible from there and comes from a sketch
  made on a hillside above Saint-Remy (F1541v); the steeple is more Dutch
  than Provencal; the cypress is pulled forward and enlarged; the bright star
  right of the cypress is Venus; the moon was really gibbous, painted crescent.
- MoMA's own technical notes and the full Li 2012 numbers were not reachable.
- Possible larger scan on Commons (44567 x 35291) reported; unchecked, may be
  an upscale.

### Candidate references for unseen parts (owner to choose)

All Saint-Remy period, all on Wikimedia Commons unless noted.
- Ground at night: Landscape with Wheat Sheaves and Rising Moon (F735,
  Kroller-Muller; the same enclosed field at moonrise); Road with Cypress and
  Star (F683, May 1890; night road, verge, wheat); Green Wheat Field with
  Cypress (F719); Long Grass with Butterflies (National Gallery).
- Village street and houses: The Large Plane Trees / Road Menders (F657,
  Cleveland, open access; the only close street view of Saint-Remy); The Road
  Menders (F658, Phillips); A Road at Saint-Remy with Female Figure (JH1875);
  View of the Church of Saint-Paul-de-Mausole (JH2124). Thinnest category: he
  painted very few houses there.
- Hills up close: Les Peiroulets Ravine (F662, MFA Boston); Entrance to a
  Quarry (F744); Mountains at Saint-Remy (F622, Guggenheim).
- Olive trees: Olive Trees with the Alpilles (F712, MoMA; painted as the
  daytime pendant to Starry Night); Olive Trees (F714, Edinburgh).
- Cypress up close: Cypresses (F613, Met); Wheat Field with Cypresses
  (National Gallery and Met versions).

## Next

- Get owner's headset report on step 1 (frame rate at each paint amount,
  shimmer, colour A vs B, flow speed, cypress up close) and act on it.
- Owner to choose references for the unseen parts (list above), then build
  step 2 (real hills and terrain) and step 3 (village).

## Known issues / open questions

- Reference scan: `reference/starry_7000.jpg` (7000 px wide, added by owner
  2026-11-14, cut down from the 663 MB original which stays on the owner's
  Mac; ask for full-detail crops if ever needed). Analysis runs at 3200 px.
- Stroke shapes are now lifted from the canvas (`tools/starry/lift_strokes.py`:
  finds single well-separated strokes, outline = shape, the photograph's light
  and shade on the paint = relief). Eight chosen by eye (candidates 4 6 10 1 19
  27 29 37). Relief is inferred from a flat photograph, not measured height.
- Ground on the knoll is provisional: the painting does not show it. Colours
  come from the bushes at its bottom edge. Needs his field studies as reference.
- Sky behind the cypress is filled in by diffusion; two star halos next to the
  tree smear into rectangles there (visible if you walk sideways).
- Extended sky: outside the frame each place takes direction and tone from
  the nearest painted sky, fading over about 20°, and tone is smeared along the
  flow so bands continue (`analyse.py`, "LIC"). Remaining flaw: herringbone
  creases run diagonally out from the frame's upper corners, where "nearest
  painted sky" jumps from one edge to another. Checked only in flat stills.
- Walking is limited to 55 m from the viewpoint; walking downhill shows the
  backdrop village sliding with you (it is at infinity until step 3).
- Wrap-around vs distant climbable hills: design needed at step 4 (village must
  be hidden by ridges from outside the valley so repeats are never seen; sky
  does not wrap). Fallback if it reads badly: ask owner again.
- Quest browser refresh-rate and sharpness controls are used as documented by
  the WebXR standard but have not been confirmed on the device.
