import * as THREE from 'three';
import { groundUndercoat, rng, shared, StrokeWriter, surfaceStrokes } from '../../paint/strokes';
import type { StarryMeta } from './sky';
import { terrain, TERRAIN_GLSL } from './terrain';

/**
 * The ground of the whole valley.
 *
 * - An undercoat over the land, coloured from the painting wherever the
 *   viewpoint can see it.
 * - The land's own paint in bands by distance, on tiles that follow you:
 *   hatched down slopes, standing as dabs on flat ground.
 * - The painting's own land strokes, set where the viewpoint sees them and
 *   tipped toward it so they are never seen edge-on; from the viewpoint they
 *   look as he painted them (`terrain_strokes.bin`). The village is still
 *   only these strokes standing on the valley floor.
 PROVISIONAL in manner: to be reworked from
 *   Wheat Sheaves and Rising Moon and Road with Cypress and Star.
 */
export async function buildGround(base: string, meta: StarryMeta) {
  const { rMin, rMax } = meta.valley;
  const [strokeData, shape, map] = await Promise.all([
    fetch(base + 'terrain_strokes.bin').then((r) => r.arrayBuffer()),
    new THREE.TextureLoader().loadAsync(base + 'land_shape.png'),
    new THREE.TextureLoader().loadAsync(base + 'ground_col.jpg'),
  ]);
  // The ground's colour as a map: compass direction across, distance from
  // the viewpoint (logarithmic) down.
  map.colorSpace = THREE.NoColorSpace;
  map.flipY = false;
  map.wrapS = THREE.RepeatWrapping;
  map.generateMipmaps = false;
  map.magFilter = map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  shape.colorSpace = THREE.NoColorSpace;
  shape.flipY = false;
  shape.wrapS = THREE.RepeatWrapping;
  shape.generateMipmaps = false;
  shape.magFilter = shape.minFilter = THREE.LinearFilter;
  shape.needsUpdate = true;
  shared.uShape.value = shape;
  shared.uGround.value = map;
  shared.uGroundRange.value.set(rMin, Math.log(rMax / rMin));

  // --- undercoat: rings round the viewpoint, finer near it
  const na = 1536;
  const nr = 240;
  const SPOKES = 384;
  const step = na / SPOKES;
  const pos: number[] = [0, terrain(0, 0), 0];
  const idx: number[] = [];
  for (let i = 0; i < nr; i++) {
    const rad = rMin * Math.pow(rMax / rMin, i / (nr - 1));
    for (let j = 0; j < SPOKES; j++) {
      const az = ((j * step + 0.5) / na) * Math.PI * 2 - Math.PI;
      const x = rad * Math.sin(az);
      const z = -rad * Math.cos(az);
      pos.push(x, terrain(x, z) - 0.03, z);
    }
  }
  for (let j = 0; j < SPOKES; j++) idx.push(0, 1 + j, 1 + ((j + 1) % SPOKES));
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < SPOKES; j++) {
      const a = 1 + i * SPOKES + j;
      const b = 1 + i * SPOKES + ((j + 1) % SPOKES);
      idx.push(a, a + SPOKES, b, b, a + SPOKES, b + SPOKES);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);

  const r = rng(42);
  const pal = meta.palettes.bush;
  const wts = meta.palettes.bushWeight.map((w, i) => (i < 5 ? w : i < 7 ? w * 0.12 : 0));
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();

  /** Strokes lying on the earth, running roughly across the slope. */
  const lying = (count: number, tile: number, len: [number, number], wid: [number, number]) => {
    const w = new StrokeWriter();
    for (let i = 0; i < count; i++) {
      p.set(r.next() * tile, r.range(0.01, 0.05), r.next() * tile);
      const a = 0.35 + r.range(-0.3, 0.3);
      t.set(Math.cos(a), 0, Math.sin(a));
      w.add({
        p, t, n: up,
        length: r.range(len[0], len[1]), width: r.range(wid[0], wid[1]),
        lift: r.range(0, 0.05), bend: r.range(-0.1, 0.1),
        colour: r.pick(pal, wts), streak: r.pick(pal, wts),
        seed: r.next(), shape: Math.floor(r.next() * 8), sway: 0, tipSway: 0, hug: true,
      });
    }
    return w.data();
  };

  /** Upright dashes of grass, leaning with the wind. */
  const tufts = (count: number, tile: number, len: [number, number], wid: [number, number]) => {
    const w = new StrokeWriter();
    for (let i = 0; i < count; i++) {
      p.set(r.next() * tile, 0, r.next() * tile);
      const yaw = 0.64 + r.range(-0.9, 0.9); // leaning with the wind
      const lean = r.range(0.1, 0.45);
      t.set(Math.cos(yaw) * lean, 1, Math.sin(yaw) * lean).normalize();
      n.set(-Math.sin(yaw), 0, Math.cos(yaw)).cross(t).normalize();
      const length = r.range(len[0], len[1]);
      w.add({
        p, t, n, length, width: r.range(wid[0], wid[1]),
        lift: r.range(-0.25, 0.25), bend: r.range(-0.12, 0.12),
        colour: r.pick(pal, wts), streak: r.pick(pal, wts),
        seed: r.next(), shape: Math.floor(r.next() * 8), sway: 0, tipSway: 0.35 * length,
      });
    }
    return w.data();
  };

  const layer = (data: Float32Array, tile: number, fade: [number, number], segments: number, near?: [number, number]) =>
    surfaceStrokes(data, { segments, tile, fade, near, terrain: TERRAIN_GLSL, tint: 0.7 });

  /**
   * The land's own paint, in bands by distance. Each band is strokes of one
   * size, present only where that size looks right from where you stand
   * (about as large to the eye as the strokes of the sky), on a tile that
   * follows you. As you walk, every part of the land is repainted at your
   * scale. Direction comes from the lie of the land; colour from the ground's
   * own colour with each stroke lighter or darker than its neighbours.
   */
  const hills = meta.palettes.hill;
  const band = (length: number, count: number, order: number, contrast: number) => {
    const from = 10 * length;
    const to = 25 * length;
    const tile = (2 * 1.25 * to) / 0.72;
    const w = new StrokeWriter();
    for (let i = 0; i < count; i++) {
      p.set(r.next() * tile, 0.04, r.next() * tile);
      const len = length * r.range(0.7, 1.35);
      w.add({
        p, t: up, n: up, // direction is taken from the land in the shader
        length: len, width: (len / 3.4) * r.range(0.8, 1.25),
        lift: 0, bend: r.range(-0.08, 0.08),
        colour: r.pick(hills), streak: r.pick(hills),
        seed: r.next(), shape: Math.floor(r.next() * 8),
        sway: 0, tipSway: length < 2 ? 0.12 * len : 0, hug: true,
      });
    }
    return surfaceStrokes(w.data(), {
      segments: 2, tile, terrain: TERRAIN_GLSL, tint: 0.8, contrast,
      near: [0.75 * from, from], fade: [to, 1.25 * to], overlay: order, orient: true,
    });
  };
  // Counts are highest for the far bands: they paint the hills, which fill
  // most of what you see of the land. `?bands=0.5` halves them (for testing).
  const k = Number(new URLSearchParams(location.search).get('bands') ?? 1);

  const group = new THREE.Group();
  group.add(
    groundUndercoat(g),
    // far to near, so nearer paint goes over farther
    band(49, 42000 * k, 0, 2.8),
    band(19.5, 42000 * k, 1, 2.8),
    band(7.8, 24000 * k, 2, 2.2),
    band(3.1, 20000 * k, 3, 1.8),
    band(1.25, 16000 * k, 4, 1.7),
    band(0.5, 16000 * k, 5, 1.7),
    // the painting's own land strokes, over the land's paint
    surfaceStrokes(new Float32Array(strokeData), { segments: 2, terrain: TERRAIN_GLSL, overlay: 8 }),
    // at your feet
    layer(lying(14000, 36, [0.35, 0.8], [0.06, 0.11]), 36, [5, 8], 2),
    layer(tufts(15000, 18, [0.16, 0.42], [0.022, 0.045]), 18, [5.5, 8.5], 2),
  );
  return { group };
}
