import * as THREE from 'three';
import { rng, shared, StrokeWriter, surfaceStrokes, undercoat } from '../../paint/strokes';
import type { StarryMeta } from './sky';
import { terrain, TERRAIN_GLSL } from './terrain';

/**
 * The ground of the whole valley.
 *
 * - An undercoat over the land, coloured from the painting wherever the
 *   viewpoint can see it.
 * - The painting's own land strokes, laid on the ground so that from the
 *   viewpoint they look as he painted them (`terrain_strokes.bin`). Away from
 *   the viewpoint they stretch along your old line of sight. The village is
 *   still only paint lying on the valley floor.
 * - Fine strokes and grass that appear around you wherever you walk, tinted
 *   by the ground they stand on. PROVISIONAL in manner: to be reworked from
 *   Wheat Sheaves and Rising Moon and Road with Cypress and Star.
 */
export async function buildGround(base: string, meta: StarryMeta) {
  const { na, nr, rMin, rMax } = meta.valley;
  const [strokeData, colData] = await Promise.all([
    fetch(base + 'terrain_strokes.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'ground_col.bin').then((r) => r.arrayBuffer()),
  ]);
  const cols = new Uint8Array(colData);

  // The ground's colour as a map the fine strokes can look up: compass
  // direction across, distance from the viewpoint (logarithmic) down.
  const rgba = new Uint8Array(na * nr * 4);
  for (let i = 0; i < na * nr; i++) rgba.set([cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2], 255], i * 4);
  const map = new THREE.DataTexture(rgba, na, nr, THREE.RGBAFormat);
  map.wrapS = THREE.RepeatWrapping;
  map.magFilter = map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  shared.uGround.value = map;
  shared.uGroundRange.value.set(rMin, Math.log(rMax / rMin));

  // --- undercoat: rings round the viewpoint, finer near it
  const SPOKES = 256;
  const step = na / SPOKES;
  const pos: number[] = [0, terrain(0, 0), 0];
  const col: number[] = [cols[0] / 255, cols[1] / 255, cols[2] / 255];
  const idx: number[] = [];
  for (let i = 0; i < nr; i++) {
    const rad = rMin * Math.pow(rMax / rMin, i / (nr - 1));
    for (let j = 0; j < SPOKES; j++) {
      const az = ((j * step + 0.5) / na) * Math.PI * 2 - Math.PI;
      const x = rad * Math.sin(az);
      const z = -rad * Math.cos(az);
      pos.push(x, terrain(x, z) - 0.03, z);
      const k = (i * na + j * step) * 3;
      col.push(cols[k] / 255, cols[k + 1] / 255, cols[k + 2] / 255);
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
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

  const group = new THREE.Group();
  group.add(
    undercoat(g),
    surfaceStrokes(new Float32Array(strokeData), { segments: 4, terrain: TERRAIN_GLSL, overlay: true }),
    layer(lying(9000, 120, [1.2, 2.8], [0.22, 0.4]), 120, [1e5, 2e5], 2, [9, 16]),
    layer(lying(14000, 36, [0.35, 0.8], [0.06, 0.11]), 36, [12, 17], 2),
    layer(tufts(12000, 72, [0.3, 0.65], [0.08, 0.14]), 72, [26, 35], 2),
    layer(tufts(15000, 18, [0.16, 0.42], [0.022, 0.045]), 18, [5.5, 8.5], 2),
  );
  return { group };
}
