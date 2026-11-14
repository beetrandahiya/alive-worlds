import { VER } from '../../version';
import * as THREE from 'three';
import { groundUndercoat, rng, shared, StrokeWriter, surfaceStrokes } from '../../paint/strokes';
import type { StarryMeta } from './sky';
import { terrain, TERRAIN_GLSL } from './terrain';

/**
 * The ground of the whole valley.
 *
 * - An undercoat over the land, coloured from the painting wherever the
 *   viewpoint can see it.
 * - A broad coat in the land's own scale: the hills hatched down their
 *   slopes, and ground the viewpoint cannot see (`terrain_broad.bin`).
 * - The painting's own land strokes, set where the viewpoint sees them and
 *   tipped toward it so they are never seen edge-on; from the viewpoint they
 *   look as he painted them (`terrain_strokes.bin`). The village is still
 *   only these strokes standing on the valley floor.
 * - Fine strokes and grass that appear around you wherever you walk, tinted
 *   by the ground they stand on. PROVISIONAL in manner: to be reworked from
 *   Wheat Sheaves and Rising Moon and Road with Cypress and Star.
 */
export async function buildGround(base: string, meta: StarryMeta) {
  const { rMin, rMax } = meta.valley;
  const [strokeData, broadData, map] = await Promise.all([
    fetch(base + 'hill_strokes.bin' + VER).then((r) => r.arrayBuffer()),
    fetch(base + 'terrain_broad.bin' + VER).then((r) => r.arrayBuffer()),
    new THREE.TextureLoader().loadAsync(base + 'ground_col.jpg' + VER),
  ]);
  // The ground's colour as a map: compass direction across, distance from
  // the viewpoint (logarithmic) down.
  map.colorSpace = THREE.NoColorSpace;
  map.flipY = false;
  map.wrapS = THREE.RepeatWrapping;
  map.generateMipmaps = true;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = 8;
  map.needsUpdate = true;
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

  const old = new URLSearchParams(location.search).get('paint') === 'old';
  const group = new THREE.Group();
  group.add(
    groundUndercoat(g),
    // The far hills: approved. Everything nearer is plain until the place
    // itself is right (`paint=old` in the address brings the old layers back).
    surfaceStrokes(new Float32Array(strokeData), { segments: 2, terrain: TERRAIN_GLSL, overlay: 1 }),
    ...(old
      ? [
          surfaceStrokes(new Float32Array(broadData), { segments: 3, terrain: TERRAIN_GLSL, overlay: 0 }),
          layer(lying(14000, 36, [0.35, 0.8], [0.06, 0.11]), 36, [12, 17], 2),
          layer(tufts(15000, 18, [0.16, 0.42], [0.022, 0.045]), 18, [5.5, 8.5], 2),
        ]
      : []),
  );
  return { group };
}
