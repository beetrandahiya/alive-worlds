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
- Colour reference: undecided — owner compares in headset: (A) canvas as it
  hangs today vs (B) same hues, deeper and more luminous for night.

### Aliveness
- Sky: strokes flow slowly along the painted swirl; composition stays put.
- No hand-painted flicker. Smooth motion everywhere.
- Wind: slow breathing sway (cypress, grass, wheat).
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

## Technology (chosen by Claude, pending owner's go)

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

## Status

- [x] Interview complete, decisions logged.
- [ ] Plan approved by owner (presented 2026-11-13, awaiting go).
- [ ] Step 0: project skeleton + deploy pipeline (owner must set
      Settings → Pages → Source: GitHub Actions once).
- [ ] Step 1: proof of look — cypress, patch of hillside, flowing sky; frame
      rate readout; A/B colour toggle.
- [ ] Step 2: terrain and composition matched from the viewpoint.
- [ ] Step 3: village and church, windows.
- [ ] Step 4: human-scale repaint everywhere, full locomotion, fast travel, wrap.
- [ ] Step 5: life — wind, fireflies, bird, cat, touch response, small events.
- [ ] Step 6: sound.
- [ ] Step 7: entry room and frame, painted hands, menu card, settings.
- [ ] Step 8: polish and performance passes.

## Known issues / open questions

- Nothing built or measured yet. All performance statements are expectations.
- Wrap-around vs distant climbable hills: design needed at step 4 (village must
  be hidden by ridges from outside the valley so repeats are never seen; sky
  does not wrap). Fallback if it reads badly: ask owner again.
- Colour A/B to be decided in headset at step 1.
