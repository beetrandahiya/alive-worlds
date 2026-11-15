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
- Unseen parts come only from his other Saint-Rémy works. References chosen
  by owner 2026-11-14:
  - Ground: both, by place. Cut wheat, stubble and sheaves from Landscape with
    Wheat Sheaves and Rising Moon on the open slopes; road and verge from Road
    with Cypress and Star for the lane down to the village.
  - Hills: both, by distance. Mountains at Saint-Rémy for overall shape and
    slopes; Les Peiroulets Ravine for rock at arm's length.
  - Village: The Large Plane Trees / Road Menders for how he paints a street,
    AND study what Saint-Rémy's houses and streets really looked like (period
    photographs, surviving architecture, the town's layout), because he shows
    too few houses to build a whole town. So: his paintings decide how things
    are painted; the real town may inform what is there.
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
- `tools/starry/skyline.py` — real skyline from elevation data (run once).
- `tools/starry/analyse.py` — measures the scan (stroke direction, flow sense,
  colour, palettes) and bakes `public/starry/*`. Re-run after changing it
  (needs numpy, scipy, opencv).
- `src/paint/` — the paint itself, shared by every world: `shaders.ts`
  (undercoat, sky strokes, surface strokes), `strokes.ts` (builders, shared
  uniforms, seeded random).
- `src/worlds/starry/` — this world: `sky.ts`, `cypress.ts`, `ground.ts`,
  `terrain.ts`. A new painting gets its own folder here and its own tools.
  The land's formulas exist three times and must match: `analyse.py`
  (`terrain_np`), `terrain.ts` (`terrain`) and the GLSL in `terrain.ts`.
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
      Study 03 (headset, 2026-11-14): frame rate good; hills "feel real,
      beautiful" but had too few strokes; walking down and looking back good;
      town from the viewpoint was fuzzier than before.
      Study 04 BUILT 2026-11-14, AWAITING HEADSET TEST: town sharp again, hills
      given their own coat, big strokes fade near the walker. Real 3D knoll,
      valley floor 28 m below it, nearer hills (to ~60 m, about 700 m away),
      far mountains (to ~350 m, about 1.6 km away), all matching the painting's
      outlines from the viewpoint. Village is still only strokes standing on
      the valley floor (church about 190 m away). Walking limit 260 m. Load now
      about 240k strokes; frame rate at this load unmeasured.
      Study 04 (headset, 2026-11-14): 72 fps always; town sharp again; strokes
      fade smoothly when approached; hills still "do not have enough paint".
      Owner: the sky is the only thing with enough paint ("I can imagine a
      true Van Gogh admirer crying looking at this"); make the hills as good
      as the sky. THIS IS THE QUALITY BAR FOR ALL LAND.
      Study 05 (headset, 2026-11-14): FAILED AND ROLLED BACK. It painted the
      land in six distance bands of strokes following the walker, widened
      live for the walker's view, about 300k strokes. Owner's report:
      55-63 fps (below target); clear shimmer/flicker; a clear edge between
      the painted hills and the continued hills; valley "grass" became
      human-height strands; live resizing "not convincing". The published
      link is back on Study 04. Commit 2cc988a holds Study 05's code; parts
      worth keeping from it: hills beyond the frame in the painted hills'
      blues with a gradual join in the colour map, the mottled undercoat, the
      slope map `land_shape.png`.
- [ ] REBUILD AS MODULES (owner's direction, 2026-11-14, agreed): build the
      sky, hills, valley fields, grass, roads/tracks, village and cypress each
      as its own thing with its own rules, reference and stroke budget, with
      designed joins between them; base the land on the real geography of
      Saint-Remy and extend from it; build systems that do not break and are
      smooth across. Owner's choices (2026-11-14):
      - Geography: painting first, real land as inspiration (keep a valley
        shaped to match the painting from the viewpoint; borrow real features
        of Saint-Remy and the Alpilles to make the rest believable).
      - Valley floor: fields, groves and hedges as painted: low wheat or
        stubble in front, divided by hedges and a lane; rounded olive trees
        and bushes in swirling strokes to the right, 3-5 m tall, each a real
        3D form like the cypress.
      - Order: hills first. One piece per test version from now on.
      Pieces: sky (done, the standard), cypress (done), hills, valley fields,
      grass underfoot, roads/tracks, village. Each: own rules, own reference,
      a fixed share of ~240k strokes, a designed join with its neighbours.
      Study 06 BUILT 2026-11-14, AWAITING HEADSET TEST: HILLS as one piece.
      All strokes fixed in the world. Beyond the frame the painted hills are
      carried on round the horizon by folding the painted span back and forth
      (mirror at each end, `AZ_L`/`AZ_R` in `analyse.py`), so colour and
      stroke direction are his everywhere and the join is exact; the church
      spire is removed from that source. Three coats (scales 0.8, 0.5, 0.3),
      about 40k strokes, placed by line of sight from the viewpoint beyond
      430 m. Hills now rise as a band (start at 78% / 60% of their distance)
      instead of a long ramp. Land hidden by the cypress takes the land beside
      it (fixes the grey rectangle); land never samples sky colour (fixes the
      pale peak). Total about 230k strokes. Known flaws: a pale upright smear
      in the hills left of the cypress; from the valley the hill strokes are
      still those laid for the viewpoint; valley floor ends in a hard dark
      edge right of the painted view (next piece: valley fields).
      Study 06 (headset, 2026-11-14): 72 fps constant; hills "much better",
      enough paint now, continuous all round, very good near the painted
      view; but odd vertical bands of similar colour further round (from the
      mirror-folding), and a slight flicker "everywhere a little, not so
      noticeable". Owner asked not to repeat the painted hills: use a system
      and/or the real topography. Chose: real skyline, low parts raised a
      little into rolling hills.
      Study 07 BUILT 2026-11-14, AWAITING HEADSET TEST: beyond the frame the
      skyline is the real one round Saint-Paul-de-Mausole
      (`tools/starry/skyline.py`, free AWS terrain tiles, cached result in
      `reference/real_skyline.npy`; real: Alpilles up to 7 degrees at bearing
      144, plain to north and west). Painting's centre is set to bearing 100;
      real heights x1.55 to meet his exaggerated mountains; horizon floor
      raised to about 1.5 degrees of rolling hills; 14 degree blend at the
      frame's ends. Paint beyond the frame is by rule (in `field()`): his hill
      palette, tone in bands along diagonal hatching (`HATCH`), broad drifts,
      a dark fold line part-way up, dark ridge line, mountains darker. The
      mirror-fold is gone. Hills about 53k strokes, total about 245k.
      The slight general flicker is not yet investigated.
      Study 07 (headset, 2026-11-14): 72 fps; real hill SHAPES approved
      ("look like real hills, not made up"); join "okay, not perfect"; but
      the rule-made paint was rejected outright ("just diagonal lines,
      disgusting, hard to look at"; Study 06's paint was "so much better").
      LESSON: never paint land by an invented rule. Paint must come from his
      canvas. Banding is tolerable if stylised and following the terrain.
      Study 08 BUILT 2026-11-14, AWAITING HEADSET TEST: real skyline kept;
      paint beyond the frame is again the painted hills' own (colour and
      stroke direction), sourced only from the span right of the cypress where
      his hills are tall (px 500 to the right edge), walked back and forth
      with bent turning points, laid by depth below the ridge with stretch
      limited to 0.75-1.35 and folded back where the source runs out (the
      bands in Study 06 were low left-hand hills stretched over tall ones).
      Study 08 (headset, 2026-11-14): HILLS PASSED. 72 fps, "hills look
      good", no streaks, no repeats noticed. Join "still just alright, a
      clear difference but better". Base of the hills "looks like nothing,
      only blurred background" (the valley floor outside the frame had no
      strokes).
      Study 09 BUILT 2026-11-14, AWAITING HEADSET TEST: VALLEY FLOOR beyond
      the frame painted with his grove paint (the swirling bushes between
      village and hills, px 770-1250, elevation -0.8 to -4.8 degrees), walked
      along and folded row after row (`GZ_L/GZ_R`, `GROVE_*`, `valley_dirs`
      in `analyse.py`); two coats (scales 1.0 and 0.6), about 18k strokes,
      fixed, tipped toward the viewpoint like the in-frame valley strokes.
      `lay_unseen` cut from 16k to 6k to pay for it. Total about 253k.
      This is paint only: no 3D trees, hedges or lane yet.
      Study 09 (headset, 2026-11-14): REJECTED. From the start it looked
      good, but walking: valley strokes far bigger than the hills', single
      giant strokes near the town, human-height strands on the knoll, and
      their fading "feels so weird". Cause: strokes sized by angle from the
      viewpoint and tipped to face it are metres long near the walker.
      LESSON: view-sized strokes are only for things the walker never gets
      near (sky, far hills). Flat ground the walker crosses must not be made
      of them, and nothing may be tipped up to face the viewpoint.
      Study 10 BUILT 2026-11-14, AWAITING HEADSET TEST: PAINTED GROUND. The
      ground's own surface carries his paint: `ground_col.jpg` is now sharp
      (4096 x 2048, from `scene_fine`, no blur), with mipmaps, anisotropy 8
      and a seam-free compass lookup. From the viewpoint it shows the painting
      (and, beyond the frame, his grove paint) exactly; no strokes stand or
      fade. Within 25-90 m of the walker it settles to its general tone so
      stretched paint does not show as blobs. Study 09's valley strokes are
      removed; `lay_unseen` back to 16k. About 235k strokes. In-frame valley
      and village strokes (tipped, fading near the walker) are unchanged and
      still have the giant-stroke problem near the town: to be replaced by
      real 3D houses and trees.
      Study 10 (headset, 2026-11-14): 72 fps; ground "still looks really
      weird"; little difference seen from the start; slightly better by the
      town; grass "a lot of strokes, out of place". Owner: "you're going
      around in circles; let's start from basics"; the town matters much
      more than the grass. AGREED: Studies 05-10 were all patches on one idea
      (project the painting onto land from the viewpoint). Stop that.
- [ ] RESTART FROM BASICS (agreed with owner 2026-11-14). Kept: sky, cypress,
      far hills. Method: (1) build the place in metres as plain forms and
      judge it in the headset; (2) paint each surface in its own space with
      his colours and his real stroke shapes; (3) add raised strokes near the
      walker, as on the cypress. Town first. Owner's choices: a real small
      village of 30-40 houses (the painted dozen as its heart; a square by the
      church, a main street, a few lanes); surfaces painted, plus raised
      strokes near you.
      Study 11 BUILT 2026-11-14, AWAITING HEADSET TEST: bare forms
      (`src/worlds/starry/village.ts`). Church where the painting puts it
      (foot at scan px 726,866 -> 210 m from the viewpoint), nave 22 x 9.5 m,
      tower 19 m, spire to 46 m (as tall as he painted it). 38 houses along a
      main street, a cross street, a back lane and a lane behind the church;
      191 round trees (groves to the right, scattered left); a lane from the
      knoll. Walls block walking. Valley ground is a plain soft tone; all
      valley strokes and foot grass are off (`?paint=old` restores them).
      Hills now use the spire-free source inside the frame too. Walking limit
      340 m. About 120k strokes (sky, cypress, hills only).
      Study 11 (headset, 2026-11-14): PLACE APPROVED as a basis. 72 fps;
      house and tree sizes all right; the walk down "feels like a journey, a
      good experience"; layout "okay from far away". Owner asked for the real
      historical layout of Saint-Remy and asked where the asylum is.
      Owner's choices after the research (2026-11-14):
      - Asylum: yes, standing behind the start (men's wing with his lit barred
        upper window, chapel tower beside it); can be walked up to, not entered.
      - Village plan: take from the real town, bring it as close to his
        imagination as possible, and IT MUST LOOK EXACTLY LIKE THE STARRY NIGHT
        FROM THE START.
      - The walled wheat field below the start: yes.
      - Church: the one he painted (tall thin spire), not the real one.
      Study 12 BUILT 2026-11-14, AWAITING HEADSET TEST (still bare forms):
      - `tools/starry/village.py` lists the church and the twelve painted
        buildings as read by eye off the scan (edges, ground line, eave, roof
        top, in 1280 px units), follows each line of sight to the valley floor
        for position and size in metres, and samples wall and roof colours
        from the canvas -> `public/starry/village.json`. Also the five painted
        trees/bushes and the three rows of grove behind the village.
      - `village.ts`: those stand facing the start. The village continues
        round an oval ring lane (78 x 58 m, centred left of the church) with
        about 23 more houses, placed ONLY where the start view cannot see
        (behind the cypress, px 185-520, or outside the frame); same rule for
        extra trees. 35 houses, 190 trees.
      - Asylum: wing 64 x 10.5 m, 11.5 m to the eave, three rows of windows,
        one lit; chapel and a 21 m square tower with a pyramid roof; about
        12 m behind the start. Forms are generic, not yet from his View of the
        Asylum and Chapel or photographs.
      - Walled wheat field 68 x 52 m at the foot of the knoll, left of the
        lane; 1.7 m stone wall (blocks walking; no gate yet).
      Study 12 (headset, 2026-11-14): 72 fps; start view "looks good, quite
      close to the painting"; house sizes good; asylum outside "alright";
      hidden part "just all right". FAULTS: the lane ran through houses; some
      houses collided with the church. Owner: from far it must look like the
      painting, up close it must be a real town where everything works. Asked
      whether the asylum is real size (it was a guess) and for proper research
      on the wheat field (where it is, how it looks).
      Study 13 BUILT 2026-11-14, AWAITING HEADSET TEST (bare forms):
      - Town plan rebuilt in `village.ts`. Streets are explicit (`roads`): a
        front street (z -92), a street between the front and middle painted
        rows (z -126), church street (z -168.6), two cross lanes (x -8, x 41)
        and a ring lane. All are laid where no painted building stands.
      - Nothing can be built into anything: true oriented-rectangle overlap
        test (`overlap`), and `onRoad` for streets. Painted neighbours that he
        drew touching give up width until they form a terrace. Extra houses
        (26) line the streets, doors to the street, only where the start view
        cannot see, borrowing wall and roof colours from the painted houses.
        Painted trees step aside if a street or house needs their spot.
      - Asylum wing 78 x 12 m. Measured on OpenStreetMap, the real complex is
        about 150 m across with wings 75-100 m long, so the first 64 m guess
        was too small, not exaggerated.
      - Wheat field moved to a provisional spot left of the lane (-58, -52),
        52 x 40 m, pending research.
      - `?up=230&pitch=89.9&x=5&z=-150` gives an overhead plan view for checks.
      Known: the plan is a straight grid inside the ring, not the winding
      lanes of the real old town.
      Study 13 has NOT yet been tested in the headset (as of Study 14).
      Owner's choices on the field (2026-11-14): directly below the start on
      the slope; wheat as it was that week (mid-June 1889: ripening yellow,
      storm-flattened); the lane runs along the outside of the wall, and you
      look over the wall into the wheat.
      Study 14 BUILT 2026-11-14, AWAITING HEADSET TEST (bare forms):
      - Field in `village.ts`: corners (-42,-42) (38,-42) (38,-88) (-42,-76),
        so about 80 m wide and 34-46 m deep on the map, far wall slanting away
        to the right. Walls on three sides (near side open: the asylum closed
        it), about 1.2 m high (shorter than the 2-2.5 m estimated for the real
        wall, so the owner can look over it), a stone hut at the far right
        corner. Wheat is a plain surface 0.45 m above the ground in two flat
        colours (standing, and laid by the storm). It sits on the 36% slope;
        the real field was nearly level. Not visible from the start view
        (checked: start-view still differs from Study 13's by 0.3% of pixels,
        all on the lane).
      - The lane is now a road in `roads`: from the start, round the field's
        near right corner, down outside its right wall to the front street.
      - Asylum wing 84 x 12 m, two storeys (8.6 m to the eave), 21 windows a
        row, his lit window on the upper row. Plain forms draw both faces.
      Studies 13+14 (headset, 2026-11-14): town "looks okay"; streets too
      straight ("give them character: a little wavy, a little uneven");
      field walls "really jagged and weird", make them a little shorter; build
      the asylum from his actual paintings of it.
      Study 15 BUILT 2026-11-14, AWAITING HEADSET TEST (bare forms):
      - His paintings fetched from Wikimedia Commons at 1280 px (the API and
        1280 px thumbnails work with plain curl; larger sizes are refused) and
        saved in `reference/vangogh/`: F803 View of the Asylum and Chapel,
        Hospital at Saint-Remy, Garden of Saint-Paul Hospital, F720 Enclosed
        Wheat Field with Rising Sun, F735 Wheat Sheaves and Rising Moon, F611
        Landscape behind Saint-Paul.
      - Asylum from them: wing 84 x 12 m, yellow-ochre, two storeys, 21 pale
        windows a row with green shutters, a band between storeys, red tiled
        roof, central door with pilasters and balcony (Hospital at Saint-Remy);
        chapel blue-grey with slate-blue roofs, nave + lower aisle + east end,
        square tower 15.5 m with paired openings and a pyramid roof (F803).
        Day colours darkened by eye for night.
      - Field wall: one continuous wall following the ground, 0.95 m high,
        pale blue-grey (as in F720/F735), three sides; hut roof red tile.
      - Streets: each road is cut into 5 m lengths and every point drifts by a
        smooth function of its position (`drift`, up to about 2.4 m), so
        streets wander but still meet at junctions; edges wobble in width.
        Houses are placed by distance walked along the bent street and turn
        with it.
      Study 15 (headset, 2026-11-14): streets "look OK"; asylum "looks okay"
      but some floors were inside the ground; the field wall "kind of
      disappears up the slope"; the field "feels a bit too high" and cannot be
      seen whole from around it; the church looks off-centre for a town (owner:
      "doesn't matter so much", it is his imagination).
      Study 16 BUILT 2026-11-14, AWAITING HEADSET TEST (bare forms):
      - Asylum and chapel floors are set at the HIGHEST ground under them
        (`groundOver`) with a stone base down to the lowest; before, they were
        set at the lowest corner and the knoll buried the lower storey.
      - Field wall is 0.95 m above the field's ground everywhere (the lane-side
        rule had let it sink below the wheat uphill). Lane moved to x 40.4,
        close beside the wall, drift 0.12. Wheat surface lowered to 0.3 m.
      - Start view identical to Study 15 (0 pixels differ).
      OPEN: the field on a 36% convex slope cannot be seen whole and reads as
      too high. A level field cannot be hidden from the start view anywhere in
      front (the slope must fall 0.3 m per metre to stay under the frame).
      Church: houses cannot be added behind it without showing in the painted
      view, so it stays near the village's far edge.
      Owner (2026-11-14): keep the field on the slope but soften it; leave
      the church where it is.
      Study 17 BUILT 2026-11-14, AWAITING HEADSET TEST (Study 16 was never
      seen live: GitHub's publish queue stalled; 17 includes it):
      - The knoll's front is now one even tilted plane: in `knoll()` the
        distance used for the fall is blended from radial `d` to straight-ahead
        `-z` where `fwd` > 0.35-0.7 (changed in all three copies: analyse.py,
        terrain.ts JS and GLSL; data rebaked). Before, the hill was a cone, so
        an 80 m wide field crowned by about 6 m. Steepness (36%) is unchanged:
        ground in front must fall about 0.3 m per metre to stay under the
        painted view's bottom edge.
      - Cypress base lowered 0.335 m to keep it exactly where it stood.
      Study 18 (2026-11-14): REJECTED from the stills ("horrible, weird
      tiled wallpaper, horrendous"), and it would not load in the headset:
      "Cannot read properties of undefined (reading 'slice')". Cause: the new
      app ran against a cached older village.json. Fixed: every data file is
      now fetched with the build's tag (`src/version.ts`, `VER`). The link is
      back on Study 17. Commit 7ac1aa4 holds Study 18's code.
      WHY IT FAILED: strokes drawn as a pattern in regular staggered rows, all
      one size and direction, coloured from a small patch folded back and
      forth. Any rule that tiles reads as wallpaper. (Same lesson as Study 07.)
      OWNER'S DIRECTION: do not get carried away; build a CONCEPT for the
      paint first, as was done for the place (bare forms before detail), and
      agree it before building.
      PAINT CONCEPT agreed with owner (2026-11-14): paint houses the way the
      sky, cypress and hills are painted. Real, individually placed raised
      strokes, never rows; three coats (dark outlines along every edge; a few
      broad strokes per plane, as few as his, always present; fine
      hand-to-arm strokes only on houses near the walker, fading by
      distance); colours taken stroke by stroke from his paint of that
      building; direction follows the form. Judge on ONE house first (the big
      dark house at the front, `data.houses[9]`), then the village, then
      trees, field, asylum, each its own round. Budget: broad + outline for
      the village about 25k; fine coats about 30k near the walker.
      Study 19 BUILT 2026-11-14, AWAITING HEADSET TEST: that one house.
      `village.py` gives each building `wallPal`/`roofPal` (28 single-stroke
      colours each, points of the lightly smoothed 7000 px scan) and `outline`
      (its darkest 12%). `paintHouse` in `village.ts` lays strokes with
      `surfaceStrokes`: walls broad 1.6-2.8 x 0.5-0.8 m level, fine 0.4-0.8 x
      0.09-0.15 m (fade 16-30 m); roofs broad ridge-to-eave, fine 0.5-1.1 m;
      outlines 0.2 m wide along ridge, eaves, verges, corners, base; openings
      get four strokes of their colour and a dark ring. This house: 358 broad,
      78 outline, 7,666 fine. The plain wall beneath is the undercoat.
      Study 19 (headset, 2026-11-14): METHOD APPROVED ("few strokes from far
      away and more closer is good"); the house "looks okay" from afar; the
      black border looked weird ("is it needed?"). Asked: paint every house
      visible in the painting; movement five times faster.
      Study 20 BUILT 2026-11-14, AWAITING HEADSET TEST:
      - All 12 painted houses and the church (nave, tower, spire, wing)
        painted by `paintBox` (was `paintHouse`). Broad 4,530 + lines 1,048
        always drawn. Fine strokes: 13 separate sets, 105k in all, each set
        visible only within its reach + 32 m of the walker (`village.update`,
        called every frame from main.ts) and fading 30-16 m in the shader.
      - Outline softened: his darkest colour lifted toward blue, 0.13 m wide,
        short strokes with about one in seven left out. Owner to say whether
        to keep it.
      - Movement (study setting, `rig.ts`): 3 m/s up to three-quarter push,
        15 m/s at full push.
      - Unpainted still: the 26 houses he did not paint, asylum, field, lanes,
        trees, valley ground.
      Study 20 (headset, 2026-11-14): "looks more painted", good from afar,
      72 fps in the village centre, no jitter. Asked: fine strokes should
      appear from further away; KEEP THE BLACK BORDER (the real painting has
      it; owner withdrew the earlier doubt); some strokes look strange,
      mainly the horizontal ones: research how he drew each building.
      Study 21 BUILT 2026-11-14, AWAITING HEADSET TEST:
      - `village.py` `stroke_run`: for each building's wall and roof patch,
        the direction his strokes run and how strongly they agree (structure
        tensor on the 7000 px scan) -> `wallRun`/`roofRun` [angle, agreement];
        check picture `reference/debug_village_runs.jpg`. Findings: church
        walls upright (81-89 deg); front roofs striped at 48-66 deg; red roof
        56 deg; low back houses level (0 +/- 8); agreement mostly 0.15-0.57.
      - `paintBox` uses those angles (roof angle negated: the plane's second
        axis runs down the slope); the less his strokes agree, the more ours
        wander. `fill` now takes any direction and shortens strokes at edges.
      - Dark line restored: his own darkest colour, 0.2 m wide (ridge 0.24),
        continuous overlapping strokes.
      - Fine strokes fade 52-28 m (was 30-16); cover cut from 1.8 to 1.3 to
        stay in budget: broad 4.8k, lines 1.2k, fine about 98k in 13 sets,
        most of them drawn at once when standing mid-village (about 225k
        total with sky, cypress, hills).
      Study 21 (headset, 2026-11-14): REJECTED ("very very bad"). Owner: "you
      are homogenizing strokes per building; you take one angle and make all
      strokes like it. Study each building in detail, each stroke, then
      build." LESSON: never summarise his paint per object (one direction, a
      palette). Read it point by point, as the sky does.
      Study 22 BUILT 2026-11-14, AWAITING HEADSET TEST:
      - `village.py` `paint_map`: for each building, his paint over its facade
        on a 44 x 24 grid: at each point the colour of the stroke there and the
        direction that stroke runs (structure tensor within about one stroke's
        width, sigma 9 px at 7000). Three maps per building: `wallMap` (eave to
        ground), `roofMap` (top to eave), `faceMap` (whole facade; used for the
        church's gable end); the spire has its own. Sampling stays clear of the
        canvas's bare edges.
      - `paintBox`/`fill`: his facade is laid over the building; each stroke
        reads colour and direction at its own point (`paintAt`), turned a
        little where his strokes agree less; its streak colour is the paint
        beside it. Coats: broad strokes at HIS size on that building (2.2-3.6
        cm x 0.6-0.95 cm of canvas; one canvas centimetre is 0.9-2.4 m on the
        building), a middling coat (0.9-1.6 x 0.24-0.4 m), fine (0.3-0.62 m,
        fading 52-28 m). Back walls and back roofs mirror the front; end walls
        reuse the wall map. Broad+middling 14.8k, lines 1.0k, fine 105k.
      - On painted houses the added window/door shapes are removed: the
        windows are his yellow strokes.
      Study 22 (owner, 2026-11-14): "not really helping". Owner asked for
      the method of the very first town (the painting, seen from the start,
      turned into strokes) and, tired of the test cycle, for several
      approaches built in parallel and shown side by side as stills (far and
      close) on one page before anything goes to the headset.
      FOUR APPROACHES BUILT 2026-11-14, AWAITING OWNER'S PICK (stills only,
      nothing published; code saved as `experiments/*.patch`, each applies to
      commit f6f6317): A the painting's strokes cast from the start onto the
      real buildings; B his individual strokes segmented from the scan and
      laid one for one (weakest: strokes too short, bare walls); C the canvas
      itself projected as each building's and tree's surface colour, plus
      raised strokes within about 50 m (sharpest from the start; murky a few
      metres from a wall); D strokes laid on each surface, each reading the
      canvas pixel it sits behind from the start (most even up close; near
      the stroke limit). Claude's recommendation: C with D's closer coat.
      In all four the ground between houses is still plain, and unseen walls
      mirror seen ones (his windows reappear on backs).
      Owner on the four (2026-11-14): chose C (canvas as the skin) but the
      FORMS are wrong: every building was a plain box facing the start, so
      his paint for two or three faces was stretched over one wall (church
      worst), and paint was reflected through buildings. Asked for a deeper
      reading of each building, research, then a proper 3D reconstruction.
      FACE-BY-FACE REBUILD BUILT 2026-11-14, AWAITING OWNER (stills only, on
      the branch, not published): `tools/starry/village_forms.py` lists each
      painted building as the faces he drew (kinds: `front` = wall + roof
      slope; `corner` = gable end + long side, turned so the gable has a given
      real width; `gablefront`; tower; spire), follows each painted corner
      along its line of sight onto the building's planes, and writes
      `public/starry/village_forms.json` (3D polygon + canvas point per
      corner) and the check picture `reference/debug_village_forms.jpg`.
      Church = annex + nave (gable to us, roof running back right) + body
      (second gable with the tower in its front) + spire; checked against his
      pen drawing F1540. Unseen faces take the opposite face's paint (wall
      for wall, roof for roof). `village.ts` `formFace` draws each face with
      the canvas skin (shader mode 3: canvas point given outright) and lays
      raised strokes within 52 m. The old painted boxes are no longer drawn;
      `data.houses`/`church` in village.json are now unused for drawing.
      Canvas crop is y 620..1006 (`village_canvas.py`). Known: lit windows
      repeat on back walls; pale front house's long wall nearly black; ground
      between houses plain; frame rate unmeasured.
      Research (2026-11-14): no published study or 3D reconstruction of the
      individual houses exists; sources are his drawings F1540 (pen copy of
      the painting) and F1541v (bird's-eye village), saved in
      `reference/vangogh/`.
      Owner (2026-11-14) on the face-by-face stills: "going in a better
      direction" but the houses looked "skewed to the back, horrendous".
      Cause: his freehand slant (roof top edge set to one side) was copied
      into the solid form, so ridges sat off-centre and gable ends leaned.
      FIXED same day: every house is an upright box, level eave, level ridge
      over its middle, gable point over the gable's middle; his slant is met
      by turning the house at most 12 degrees; each face still wears the
      canvas points traced for it. LESSON: his drawing's skew belongs to the
      paint, never to the solid form. Awaiting owner on the new stills.
      Owner (2026-11-14): "house shapes look a bit better now; fix the other
      things". DONE same day (stills, branch only): unseen walls take the
      lamp-free stretch of that house's wall (`calm` in village_forms.py);
      pale house's long wall borrows its gable end's paint (`wallsrc`); each
      painted tree looks up his paint where HE painted it (offset carried in
      the tree's colour slot), and a tree hidden from the start by a building
      borrows the nearest shown tree's paint; a close coat (0.14-0.36 m
      strokes, fading 12-7 m, about 14k per house, 262k in all sets, drawn
      only by the wall you stand at). Canvas crop now y 620..1010.
      OPEN, needs owner's choice: the ground inside the village (he shows
      almost none; projecting the painting onto ground was rejected in
      Studies 09/10; tiling a patch is forbidden by the lessons).
      Study 23 PUBLISHED 2026-11-15, AWAITING HEADSET TEST: all of the above
      (face-by-face forms, canvas skin, raised strokes within 52 m, close
      coat within 12 m, lamp/tree fixes). First headset test of this method.
      Frame rate with the close coat is unmeasured.
      Owner (2026-11-15): ASYLUM ON HOLD. Do not build or paint it further
      for now; owner asked how he felt about the asylum and will decide
      whether it stays at all (the plain forms behind the start are still in
      Study 23). Do not work on it until the owner says.
      Study 23 (headset, 2026-11-15): 72 fps everywhere, also close up. Start
      view "mostly good"; house shapes good; front houses "beautiful even
      when you go close"; backs believable. Faults: the church should show a
      gable (triangle) facing you right under the spire; half the spire wore
      sky paint; the back-row houses "look kind of off", the dark line on
      roof edges was missing; trees fine from afar but up close read as his
      paint laid over a round ball ("horrible"; the cypress is the standard).
      Owner: HIDE THE ASYLUM in this version but keep its code.
      Study 24 PUBLISHED 2026-11-15, AWAITING HEADSET TEST:
      - Church: the tower no longer comes down in front of the second gable;
        that gable shows whole, with his arched opening in it; the belfry
        sits astride the ridge 2 m back; spire upright on it.
      - Spire: his needle traced properly (base 718..740 at row 801, point at
        721,642); every face wears that paint. (The first reading had put the
        point at 731,633, half over sky.)
      - Dark lines: `outline()` in village.ts lays his dark line along every
        real edge of each painted building (not where a wall meets the ground,
        not between a wall and the gable above it): 1.7k strokes, always drawn.
      - Trees: each painted tree is a body plus 4-6 boughs (lumps), its
        near strokes lift and curl off the surface, and a coat of big
        standing strokes (`boughs`, about 26k, always drawn) breaks the
        outline. Still his paint by line of sight; far side mirrors the near.
      - Asylum hidden by `SHOW_ASYLUM = false` in village.ts (code kept).
      - Ground right round the start no longer fans out in spokes (one tone
        within 7-20 m; GROUND shader).
      Study 24 (headset, 2026-11-15): "looks better now". Faults: the third
      house right of the church had its lit windows spanning wall and roof and
      mirrored behind (misread: two houses taken as one, eave too low); some
      houses show blank walls with no door or window; spire still a little
      sky at the edges ("not too bad"); stray dark lines down the middle of
      the church gable (the nave's far end poking into the next gable); the
      dark arch in that gable does not reach the ground (it is a tall window
      in the painting; left as he painted it); trees "still big circular
      blobs with more detail", owner asks if there is a better way; the part
      of the start view behind the cypress is "a weird blur" (hills filled by
      stretching there, the 26 unpainted houses, plain ground).
      Study 25 PUBLISHED 2026-11-15, AWAITING HEADSET TEST:
      - "long" split into "lit" (px 955-1023, eave 877, lamps in the wall,
        wall paint stops at row 897 above the tree in front) and "brown"
        (1024-1072, eave 895).
      - `openings()` in village_forms.py: every wall he could not see (backs,
        ends, far gables) gets a door and dark windows as raised panels
        wearing his own paint of a door (striped house) and a window (pale
        house's gable). Faces he painted are untouched, so the start view is
        unchanged.
      - Outline strokes are not laid where an edge runs inside a neighbouring
        building. Spire paint narrowed to 720.5..738.5 / 722.5,644.
      PROPOSED to owner, awaiting answer: build trees the way the cypress is
      built (no skinned ball; made only of standing strokes laid in his
      curling arcs); and next piece = the part of the view behind the cypress
      (hill strip rebake, the 26 unpainted houses, ground).
      Study 25 (headset, 2026-11-15): spire "looks alright"; the tall window
      in the gable "makes sense" (keep it); but the church gable's paint only
      looked shifted sideways: "make the gable slimmer". Owner: now paint the
      rest of the houses and fill the hills and the land behind the cypress.
      Study 26 PUBLISHED 2026-11-15, AWAITING HEADSET TEST:
      - Church: second gable is px 722-757 (was 703-757), apex 740,830, so
        its edges are his dark lines and the window is centred; the nave's
        long side now runs to px 722.
      - The 26 houses he did not paint: `borrowedHouse()` in village.ts builds
        each as a Form and paints it like the painted ones, wearing the wall
        and roof paint of a randomly chosen painted house (`donors` in
        village_forms.json: each house's lamp-free wall stretch and its roof),
        sometimes mirrored, with his door and dark windows. Raised strokes
        within 52 m; no hand-sized close coat on these (memory).
      - Small extra trees wear a painted tree's paint (40% stroke density);
        up to 225 trees, out to 400 m.
      - Behind the cypress: FINDING: the hills there are low, so what showed
        was far flat ground wearing the painting as projected from the start,
        which streaks from anywhere else. The ground's sharp paint is now
        kept to the hills only (GROUND shader, by height); far flat ground is
        soft tone. Start view differs by about 2% of pixels (that softening
        and the church).
      - Strokes held in memory rose to about 1.07 million (was about 0.6
        million when last measured at 72 fps); always-drawn about 158k.
        Loading time and frame rate UNMEASURED.
      STILL OPEN: ground inside the village (owner has not chosen); trees
      rebuilt cypress-style (proposed, no answer yet).
      Study 26 (headset, 2026-11-15): frame rate "perfect"; church gable
      better; other houses "look good, most are nice, some a bit off"; start
      view all right. NOT FIXED: behind the cypress still a blur ("why don't
      we just fill the hills there like other places"); small trees show only
      horizontal bands ("make all the trees well now"). GROUND: owner wants
      one consolidated system drawn from his several paintings of roads,
      grass and town streets.
      Study 27 PUBLISHED 2026-11-15, AWAITING HEADSET TEST:
      - Hills behind the cypress: the real cause was a GAP IN THE HILLS
        (RIDGE in analyse.py sank to rows 742-760 across px 190-480, which he
        hid behind the tree). RIDGE now carries on at rows 712-730 for px
        195-440 (inside the tree's outline, so the start view is untouched),
        and land inside the outline is painted like the hills beyond the
        frame (walked hill paint), not from the filled-in guess. Rebaked.
      - Trees: `tree()` rebuilt. A tree is an inner mass (84% size, still
        wearing his paint of a tree so the start view holds) under nothing but
        standing, curling strokes: a coat always drawn (about 48k strokes in
        all) and an arm-length coat within 56 m. His WHOLE tree is laid over
        the whole of each tree (scale carried in the fold mode's fraction), so
        small trees no longer wear a magnified patch. A first try with a plain
        dark inner mass made the groves dark from the start and was dropped.
        LESSON: whatever is under the strokes must itself read as his paint
        from the start.
      GROUND STUDY in progress (reference/vangogh/GROUND_STUDY.md).
      Study 27 (headset, 2026-11-15): REJECTED on trees and hills. Trees "a
      mess": a tree inside with strokes outside reads as two things; far
      groves behind the town SHIMMER (too many small standing strokes far
      away); small trees still striped; the start view looked odd because of
      the trees. Hills behind the cypress STILL not there. Owner: start again
      from basic principles (what an olive tree looks like in his paintings),
      do not jump steps; do not build the roads yet.
      WHY THE HILLS DID NOT CHANGE: analyse.py has TWO point lists. `RIDGE`
      only separates sky from land in the picture; the hills' actual heights
      come from `a1, e1 = line_to_az_el([...])` further down. Study 27 edited
      RIDGE only. LESSON: after any terrain change, print ridge.bin by
      compass direction and count hill strokes by direction before claiming
      anything (both are one-liners; see this session).
      Study 28 PUBLISHED 2026-11-15, AWAITING HEADSET TEST:
      - Both lists now carry the hills on behind the cypress (px 200-455,
        rows 684-712). Baked heights there: 40-45 m (were 2-6 m); hill strokes
        there: about 380 per 5 degrees (were about 15). The dips at the
        tree's two edges (px 190 and 480) are his and stay.
      - Sky strokes, star dabs, sky undercoat and all palettes restored to the
        Study 26 files byte for byte (a rebake re-rolls them). Start view
        differs from Study 26 by 4.4% of pixels: hills right of the church
        re-laid by the same rule, and trees.
      - Trees put back to the Study 26 builder; small extra trees plain.
      TREE STUDY shown to owner as an artifact (his trees are nested arches:
      each grove tree is a fan of 5-8 bowed strokes with a dark contour; big
      bushes are concentric shells). Nothing to be built until the owner
      agrees the concept. GROUND: study shown, on hold until trees are right.
      Owner (2026-11-15): "tree study looks right". FIRST TRY BUILT, stills
      only, behind `?trees=arch` (default unchanged, not announced as a
      study): `archTree()` in village.ts: dark heart (80% dome) + 13 hoops of
      bowed strokes whose crowns step evenly as seen from in front, a dark
      stroke at each lee foot, shorter hoops within 48 m; colour read from his
      paint of that tree along the arch. About 3.5k always-drawn strokes for
      all 47 painted trees. Reads as nested arches, but too dark (heart shows
      too much), too upright and uniform, stringy up close, and further from
      his painting from the start than the skinned trees. Shown to owner.
      Owner (2026-11-15) on the arch first try: "ugly"; in the real painting
      a tree from far is full long strokes each spanning about half the tree;
      "do the stroke by stroke research again".
      SECOND TRY, stills only, behind `?trees=his`: `tools/starry/
      tree_strokes.py` follows each stroke on the canvas along the paint's own
      direction while its colour holds (2,095 strokes; x0 y0 x1 y1 bow width
      colour streak -> `public/starry/tree_strokes.bin`; check picture
      `reference/debug_tree_strokes.jpg`). `layHis()` in village.ts lays each
      on the tree its line of sight meets, as one long bowed raised stroke,
      mirrored onto the far side; the mass beneath is the smooth skinned
      ellipsoid, no lumps, no other strokes. About 2.7k strokes, always drawn.
      Much closer to the painting from the start. Known: tracing cuts his
      longest strokes short (median 1.2 cm, 90% 2.6 cm of canvas; his arches
      run 3-5 cm); form is still a rounded mass. Shown to owner.
      Owner (2026-11-15) on the second try: "a bit better, coming closer, could
      be much much better": trees need MORE OUTLINE and CLEANER FILL; marked
      three places: far grove row behind the spire blurry/empty and not
      touching the hills; gap between the lit house and trees; right-hand
      fields lack their outlines.
      THIRD TRY (stills, `?trees=his`): trees 12% larger (`GROW`) so rows run
      together; his dark strokes laid last and proud; tree mass softened to
      tone (`uTreeSoft`, mip 2.5); strokes wider; traced strokes that meet no
      tree are laid FLAT on ground 395-480 m out (beyond the 340 m walk
      limit, so never approached). A 28% growth and mip 4.5 were tried and
      made blurred balls. STILL WRONG: mid gap is unbuilt village ground;
      up close a tree is a striped ball with bare top and sides; long
      strokes still cut by the tracing.
      Owner (2026-11-15) on the third try: "still shitty"; then: "you had
      them quite good before we started all this". DECISION: TREES STAY AS IN
      STUDY 28 (the Study 26 builder: his canvas as the skin on a lumpy mass,
      a few big strokes standing off; small edge trees plain). The arch and
      traced-stroke trials stay in the code behind `?trees=arch` / `?trees=his`
      but are abandoned; do not reopen tree work unless the owner asks.
      LESSON: rebuilding his paint from parts by my own rules (arches, traced
      bars) loses what makes it his; where a thing already reads as his from
      the start, change its SHAPE if the shape is wrong, never its paint.
      Owner then asked to look at what was different "back when we fixed the
      gable and spire" (Studies 24/25), when the trees were good.
      FOUND: the tree code was already the same as then. What had changed was
      the LAND BEHIND THEM: Study 26 made all far flat ground a soft tone (to
      stop streaks behind the cypress), which blurred the ground the groves
      stand on and the pale fields on the right, so the trees no longer met
      the hills. That was the "blurry, empty" look the owner marked.
      Study 29 PUBLISHED 2026-11-15, AWAITING HEADSET TEST: far flat ground
      wears the painting again as in Study 25, except in the compass span
      hidden by the cypress (az -0.47..-0.13 rad), where it stays soft and
      the new hills stand. Start view matches Study 25's still closely.
      LESSON: when something that was good looks worse, diff against the
      version where it was good BEFORE redesigning it.
      Study 29 (owner, 2026-11-15): "alright, good". Asked for the black
      outline on the trees as in the painting, placed exactly where his is.
      Study 30 PUBLISHED 2026-11-15, AWAITING HEADSET TEST: the dark strokes
      among the traced ones (`tree_strokes.bin`, luminance under 0.2) are
      followed along their lines of sight from the start onto the real tree
      faces (ray against every painted-tree triangle) and laid there as
      raised bowed strokes, 0.18 m proud, always drawn. Only strokes that
      land on a tree are used (about 200). Trees otherwise unchanged. Effect
      from the start is modest in stills.
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

## Reference study: starrynightrider.com (reviewed 2026-11-14)

Owner pointed to it for METHOD, not style (style is cartoonish, bright, a
bicycle game with lamps and toon lighting; not wanted). Seen through headless
software rendering for about a minute plus a read of its shipped code; audio
and multiplayer not examined.
- Same base as ours: three.js r187; the painting set at 60 degree width,
  pitch 7.3; cypress about 17 m away; hills at about 440 m.
- Loads only five images: the painting, the sky with the cypress painted
  out, a flow map, a heavily blurred "fill" of the painting, a cypress mask.
- THE WORLD IS A REAL PLACE BUILT IN METRES: streets, about a hundred houses
  with roofs, doors, windows, chimneys, a church, groves of round trees,
  fields, hills. It is not derived from the painting's pixels; it is laid
  out so the start view resembles the painting.
- PAINT IS DRAWN ON EACH SURFACE, IN THAT SURFACE'S OWN SPACE, PER PIXEL:
  a rule in the surface's material lays rows of brush dabs (two interleaved
  layers so it reads as overlapping wet paint), each with bristle streaks, a
  lit upper edge and tapered ends. Dabs are therefore the right size on
  every surface from every position, sharp at any distance, never fade or
  pop, and cost no extra geometry.
- The painting itself is projected onto the world only inside its window
  from the start view, feathered at the edges into each object's own colour.
- Sky: strokes computed per direction, coloured from the painting, moved
  along the flow map. (Ours, with real stroke geometry, is richer.)
Takeaway for us: stop deriving land from one viewpoint's projection. Build
the place in metres; give every surface paint in its own space; use his
colours and his real stroke shapes rather than invented dabs.

## The real place (researched 2026-11-14)

Sources: OpenStreetMap (fetched via an Overpass mirror, overpass.kumi.systems;
the main server refused), Wikipedia EN/FR with their citations, The Art
Newspaper, IGN altimetry. Items marked (unconfirmed) were not read on a page.
- THE VIEWPOINT IS THE ASYLUM. Saint-Paul-de-Mausole, 43.776668 N 4.835159 E,
  about 105 m up. His bedroom: upper floor of the men's wing, barred window
  facing east. Letter 776: "Through the iron-barred window I can see an
  enclosed square of wheat". He was not allowed to paint in the bedroom; the
  painting was made by day in his ground-floor studio, about 18 June 1889.
- From the window, really: a walled wheat field, then olive groves and
  vineyards rising to the Alpilles foothills. No village.
- The asylum complex: Romanesque chapel with a square bell tower under a
  pyramidal stone roof, an 11th-12th century cloister, L-shaped early-19th-
  century men's blocks round a walled garden of about 1 ha.
- The real town is NOT in the view: its church (Collegiale Saint-Martin) is
  about 1,380 m away at bearing 344 (north-north-west), about 48 m lower.
  The painting looks about east (our bearing 100), mountains to the right
  (Mont Gaussier, 303 m, about 1.1 km due south; our skyline peak at 144).
- The painted village is an addition, based on drawing F1541v (view of
  Saint-Remy from a hillside above it). Its steeple is "more Dutch than
  Provencal" (Pickvance). The real church tower is Gothic, 14th century,
  slender, over 45 m (so our 46 m spire is the right height).
- The cypress: cypresses stood small beyond the field's far wall; he enlarged
  one and pulled it forward.
- The real old town: an oval about 300 m across by map measurement (one source
  says about half a kilometre), ringed by boulevards on the old walls
  (Mirabeau, Marceau, Victor Hugo, Gambetta), tight winding lanes inside, the
  church on the western edge, gates Porte Saint-Paul (south) and Portail du
  Trou (north), squares Pellissier and Favier. Limestone and ochre fronts.
  About 5,700 people around 1890. Storeys (2-3), shutters, low Roman-tile
  roofs: (unconfirmed). OSM extract of streets and 2,619 building outlines is
  in the scratchpad only; refetch if needed.
- Les Antiques (Roman arch and mausoleum) stand about 370 m south-south-west
  of the asylum; Glanum was still buried in 1889.
- Historical maps exist but were not opened: Napoleonic cadastre (Archives
  departementales 13), Etat-major map on remonterletemps.ign.fr.
- His other views that fix the geography: Enclosed Field series and Wheat
  Sheaves and Rising Moon (the field east of the window); Mountainous
  Landscape behind Saint-Paul (from the bedroom window); Olive Trees with the
  Alpilles and Mountains at Saint-Remy (looking south from groves by the
  entrance); View of the Asylum and Chapel (the only one showing the tower);
  Garden of Saint-Paul Hospital (inside the walled garden).

### The walled wheat field and the asylum buildings (researched 2026-11-14)

"(measured)" = taken from today's OpenStreetMap outlines or coarse elevation
tiles, not an 1889 survey. Offsets are metres east/north of the cloister.
- His real bedroom was on the upper floor (one above ground) of the men's
  EAST wing, now a closed working hospital, 30-110 m north of the cloister.
  The room shown to visitors (above the cloister's east gallery) is a
  reconstruction, not his. Both look east over the same enclosure. Studio:
  ground floor (possibly north wing).
- The field lies directly below the window, between the building and the
  park wall: "a field enclosed by stone walls just beneath his window".
  Size (measured): the enclosure is about 145 m north-south; opposite the
  men's wing it is about 80 x 80 m ("an enclosed square of wheat"). The far
  (east) wall is not parallel to the wing: it slants away to the right
  (Kroller-Muller: "slopes steeply diagonally to the right"). The ground is
  nearly level: about 3 m fall to the east and north (measured).
- Wall: pale grey coursed stone, on the north, east and south sides (the
  buildings close the west); about 2-2.5 m high judging from a photograph
  (no figure found); a small tiled stone hut at its right-hand end. Beyond
  it: "the grey foliage of a few olive trees, some huts and the hills"
  (letter, about 9 June 1889). No gate found.
- Through his year: late May green with poppies and daisies in front; about
  9 June flattened by a storm; 16 June "turning yellow... warm tones of a
  bread crust"; reaped late June; 6 July stacks stand in it; October parched
  clods; November young wheat in furrows, rain. MID-JUNE 1889 (Starry Night):
  ripening yellow wheat, storm-flattened, about a week before reaping.
- Night/twilight colour: Wheat Sheaves and Rising Moon (F735) is "dull
  yellow-ochre and violet"; its light purple has faded to whitish. Rising
  Sun (F737): "field is purple and yellow-green".
- He painted the field about fourteen times (F720, F611, F617, F618, F619,
  F735, F641, F625, F706, F650, F722, F737...). F803 View of the Asylum and
  Chapel was painted from inside the field and is his only work showing the
  tower; F1602r is a drawing of the wall alone.
- Buildings (measured): men's east wing about 84 m long, 11-14 m deep, long
  axis about 5 degrees west of north, a 33 m return eastward at its south
  end; north wing about 98 x 12 m; cloister and church block about 104 x 70 m
  to the south; walled garden about 93 x 104 m in the angle to the west
  (one hectare on three levels). Two storeys plus attic, pale ochre render,
  Roman-tile roof (recalled, unconfirmed). Garden walls red ochre (letter).
- Bell tower: Romanesque, square, two stages with paired openings on twin
  colonnettes, Lombard bands, a sundial, pyramidal roof of limestone slabs.
  Height not found.
- Not found: wall height in 1889, any gate, tower height, the wing's eave
  height and window count, shutters, the size or position of his room.
- Photographs worth opening next: Wikimedia Commons categories "Vincent van
  Gogh's room in Saint-Paul de Mausole" and "Monastere Saint-Paul-de-Mausole";
  blogs.futura-sciences.com/e-luminet (window view and an aerial).
- OUR WORLD VERSUS THIS: we stand on a knoll 28 m above a valley, as the
  painting implies; in reality he was one floor above a level field. In our
  terrain the slope below the brow falls faster than the bottom edge of the
  painted view, so everything on that slope (out to about 85 m) is invisible
  from the start: a field there does not alter the painted view.

## Next

- Agree the modular rebuild plan with the owner, then build it one module
  per study.
- Step 3: the village in 3D. Before building, research real Saint-Rémy
  houses and streets and bring the owner a layout proposal. The reference
  paintings still need to be brought into `reference/` (Wikimedia refuses
  larger downloads from the cloud machine; Cleveland's open-access copy of
  The Large Plane Trees may be reachable; otherwise ask the owner as before).
- Rework the ground's manner from the two chosen ground paintings.

## Lessons (do not repeat)

- Paint is never a repeating pattern on a surface (Study 18) and never an
  invented rule (Study 07). What the owner has loved every time (sky, cypress,
  hills) is individually placed, real, overlapping strokes whose colour and
  direction come from the canvas.
- Agree a concept with the owner before building any new kind of thing.
- When the app and its data change together, the data must be versioned.

- Measured budget on Quest 3 in the Quest browser, default resolution: about
  240k strokes holds 72 fps; about 300k drops to 55-63. Every module gets a
  share of roughly 240k and must stay inside it.
- Strokes must be fixed in the world. Anything whose size or shape depends
  on where the head is (live widening, tipping toward the walker) shimmers
  and reads as fake in the headset. This was the founding rule of the project
  and Study 05 broke it. What IS fine (confirmed smooth in Study 04): a fixed
  stroke fading out as the walker comes near it, and fine strokes on a tile
  round the walker's feet.
- One change per study. Study 05 changed colour, structure, density and
  orientation of the land at once, so its faults could not be told apart.
- Flat stills from this machine do not show shimmer, frame rate, or scale
  (human-height "grass" looked fine in stills). Scale must be reasoned in
  metres against a 1.7 m person before publishing.
- A stroke standing upright is an object with a height. Only things that are
  really that tall (grass 0.3 m, wheat 1 m, bushes 2 m) may stand.
- Screenshots from the owner (2026-11-14) also show, in Study 04/05 alike: a
  grey rectangular patch on the ground right of the cypress (the filled-in
  area behind the tree, projected onto the land) and a pale triangular peak
  right of the dark mountain. Both are bake faults in `analyse.py`.

## Known issues / open questions

- Reference scan: `reference/starry_7000.jpg` (7000 px wide, added by owner
  2026-11-14, cut down from the 663 MB original which stays on the owner's
  Mac; ask for full-detail crops if ever needed). Analysis runs at 3200 px.
- Stroke shapes are now lifted from the canvas (`tools/starry/lift_strokes.py`:
  finds single well-separated strokes, outline = shape, the photograph's light
  and shade on the paint = relief). Eight chosen by eye (candidates 4 6 10 1 19
  27 29 37). Relief is inferred from a flat photograph, not measured height.
- Ground detail (grass, lying strokes near you) is provisional in manner;
  references are chosen (see Decisions) but not yet applied.
- How the land is painted (all in `analyse.py`, drawn by `ground.ts`):
  1. Undercoat: solid ground coloured per pixel from `ground_col.jpg`, a map of
     the ground in rings round the viewpoint (the painting where the viewpoint
     sees it, his hill and field colours elsewhere), blurred to tone only.
  2. Broad coat (`terrain_broad.bin`, hugging the ground): hills hatched
     diagonally down their slopes at their own scale; dark field strokes on
     ground the viewpoint cannot see.
  3. The painting's land strokes (`terrain_strokes.bin`): placed where the
     viewpoint's line of sight meets the ground. Within about 400 m they are
     tipped toward the viewpoint so they are never seen edge-on (flat strokes
     on the valley floor broke up and made the town fuzzy). On far hills they
     lie on the slope (tipped ones stood above ridges like sails).
  4. Fine strokes and grass on tiles that follow the walker, tinted by the map.
  Coats 2 and 3 are drawn over everything in a fixed order, judged for depth
  as if slightly nearer, fade when seen edge-on, and fade out within a few
  stroke-lengths of the walker (seen from behind and close, tipped strokes are
  giant slabs). Between about 35 m and the fade distance the valley floor is
  mostly undercoat: a known thin zone.
- Stroke relief had the canvas weave in it, which showed as a fabric pattern on
  large strokes; `lift_strokes.py` now smooths it out along the stroke.
- Lesson: a speckled dark patch in headless renders is alpha-to-coverage
  dither on a large half-covered stroke, not a depth fault. To find a rogue
  layer, hide ground layers one at a time.
- Hills are a ring: each compass direction has one height and distance, so
  from above they are concentric walls. Fine from the valley; needs real
  shaping before anyone climbs them (step 4).
- Overlay coats are drawn after the cypress's own strokes and tested against
  depth, so the cypress hides them; anything added later that should hide land
  strokes must write depth before them.
- Sky behind the cypress is filled in by diffusion; two star halos next to the
  tree smear into rectangles there (visible if you walk sideways).
- Extended sky: outside the frame each place takes direction and tone from
  the nearest painted sky, fading over about 20°, and tone is smeared along the
  flow so bands continue (`analyse.py`, "LIC"). Remaining flaw: herringbone
  creases run diagonally out from the frame's upper corners, where "nearest
  painted sky" jumps from one edge to another. Checked only in flat stills.
- Wrap-around vs distant climbable hills: design needed at step 4 (village must
  be hidden by ridges from outside the valley so repeats are never seen; sky
  does not wrap). Fallback if it reads badly: ask owner again.
- Quest browser refresh-rate and sharpness controls are used as documented by
  the WebXR standard but have not been confirmed on the device.
