import * as THREE from 'three';
import { rng, StrokeWriter, surfaceStrokes, undercoat } from '../../paint/strokes';
import type { StarryMeta } from './sky';
import { terrain, TERRAIN_GLSL } from './terrain';

/**
 * The hillside under your feet.
 *
 * PROVISIONAL: the painting does not show this ground. Colours are taken from
 * the dark bushes along its bottom edge; the dashes follow his field paintings
 * in manner only. To be reworked from his Saint-Rémy field studies at step 2.
 *
 * Layers: an undercoat, strokes lying on the earth, and upright dashes of
 * grass. The stroke layers repeat on tiles that follow you, so there is always
 * fine paint where you stand without painting the whole hill finely.
 */
export function buildGround(meta: StarryMeta) {
  const r = rng(42);
  const pal = meta.palettes.bush;
  const wts = meta.palettes.bushWeight.map((w, i) => (i < 5 ? w : i < 7 ? w * 0.12 : 0));
  const up = new THREE.Vector3(0, 1, 0);

  // --- undercoat
  const RINGS = 70;
  const SPOKES = 72;
  const pos: number[] = [0, terrain(0, 0), 0];
  const col: number[] = [...pal[2]];
  const idx: number[] = [];
  for (let i = 1; i <= RINGS; i++) {
    const rad = 170 * Math.pow(i / RINGS, 2.2);
    for (let j = 0; j < SPOKES; j++) {
      const a = (j / SPOKES) * Math.PI * 2;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      pos.push(x, terrain(x, z) - 0.02, z);
      const k = Math.sin(x * 0.21 + 1) * Math.sin(z * 0.17) + 0.6 * Math.sin(x * 0.63 + z * 0.4);
      const c = pal[k > 0.5 ? 3 : k > -0.3 ? 2 : 1];
      col.push(c[0], c[1], c[2]);
    }
  }
  for (let j = 0; j < SPOKES; j++) idx.push(0, 1 + ((j + 1) % SPOKES), 1 + j);
  for (let i = 1; i < RINGS; i++) {
    for (let j = 0; j < SPOKES; j++) {
      const a = 1 + (i - 1) * SPOKES + j;
      const b = 1 + (i - 1) * SPOKES + ((j + 1) % SPOKES);
      idx.push(a, b, a + SPOKES, b, b + SPOKES, a + SPOKES);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
  g.setIndex(idx);

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
    surfaceStrokes(data, { segments, tile, fade, near, terrain: TERRAIN_GLSL });

  const layers = [
    layer(lying(9000, 120, [1.2, 2.8], [0.22, 0.4]), 120, [1e5, 2e5], 2, [9, 16]),
    layer(lying(14000, 36, [0.35, 0.8], [0.06, 0.11]), 36, [12, 17], 2),
    layer(tufts(12000, 72, [0.3, 0.65], [0.08, 0.14]), 72, [26, 35], 2),
    layer(tufts(15000, 18, [0.16, 0.42], [0.022, 0.045]), 18, [5.5, 8.5], 2),
  ];
  const group = new THREE.Group();
  group.add(undercoat(g), ...layers);
  return { group };
}
