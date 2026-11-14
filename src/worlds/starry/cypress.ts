import * as THREE from 'three';
import { rng, StrokeWriter, surfaceStrokes, undercoat } from '../../paint/strokes';
import type { StarryMeta } from './sky';
import { terrain } from './terrain';

/**
 * The cypress. In the painting it is a cluster of dark flames filling the left
 * foreground. Its outline was read off the scan and turned into five flames:
 * sideways offset, depth offset, height and base radius, in metres, for a tree
 * standing 14 m from the viewpoint, 21 degrees left of centre.
 */
const DISTANCE = 14;
const AZIMUTH = THREE.MathUtils.degToRad(-21);
const FLAMES = [
  { x: 0.0, z: 0.0, h: 14.3, r: 1.75, phase: 0.0 },
  { x: -0.95, z: 0.3, h: 11.1, r: 0.5, phase: 1.7 },
  { x: 1.0, z: 0.2, h: 7.5, r: 0.95, phase: 3.1 },
  { x: 1.8, z: -0.5, h: 7.4, r: 1.2, phase: 4.4 },
  { x: 3.1, z: 0.1, h: 4.6, r: 1.4, phase: 5.6 },
];
const SWAY_TOP = 0.38; // metres the highest tip moves in the wind

export const CYPRESS_POS = new THREE.Vector3(Math.sin(AZIMUTH) * DISTANCE, 0, -Math.cos(AZIMUTH) * DISTANCE);

type Flame = (typeof FLAMES)[number];

export function buildCypress(meta: StarryMeta) {
  const r = rng(1889);
  const pal = meta.palettes.cypress;
  const wts = meta.palettes.cypressWeight;
  const view = new THREE.Vector3(Math.sin(AZIMUTH), 0, -Math.cos(AZIMUTH));
  const right = new THREE.Vector3(-view.z, 0, view.x);
  const up = new THREE.Vector3(0, 1, 0);
  const baseY = terrain(CYPRESS_POS.x, CYPRESS_POS.z) - 0.4;
  const tallest = FLAMES[0].h;

  const profile = (s: number) => Math.pow(1 - s, 0.95) * (0.72 + 0.28 * Math.min(1, s / 0.12));
  const radius = (f: Flame, s: number, th: number) =>
    f.r * profile(s) * (1 + 0.1 * Math.sin(th * 3 + s * 11 + f.phase) + 0.06 * Math.sin(th * 5 - s * 17 + f.phase * 2));
  const axis = (f: Flame, s: number, out: THREE.Vector3) =>
    out
      .copy(CYPRESS_POS)
      .addScaledVector(right, f.x + 0.022 * f.h * Math.sin(s * 6 + f.phase) * s)
      .addScaledVector(view, f.z + 0.015 * f.h * Math.cos(s * 5 + f.phase) * s)
      .setY(baseY + s * f.h);
  const sway = (y: number) => SWAY_TOP * Math.pow(Math.max(0, (y - baseY) / tallest), 2);

  const radial = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const point = (f: Flame, s: number, th: number, shell: number, p: THREE.Vector3, n: THREE.Vector3) => {
    radial.copy(right).multiplyScalar(Math.cos(th)).addScaledVector(view, Math.sin(th));
    axis(f, s, p).addScaledVector(radial, radius(f, s, th) * shell);
    n.copy(radial).addScaledVector(up, (f.r / f.h) * 2.2).normalize();
    tangent.copy(right).multiplyScalar(-Math.sin(th)).addScaledVector(view, Math.cos(th));
  };

  // --- the dark mass under the strokes
  const pos: number[] = [];
  const col: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const RINGS = 28;
  const SIDES = 14;
  for (const f of FLAMES) {
    const start = pos.length / 3;
    for (let i = 0; i <= RINGS; i++) {
      for (let j = 0; j <= SIDES; j++) {
        const s = i / RINGS;
        point(f, s * 0.985, (j / SIDES) * Math.PI * 2, 0.86, p, n);
        pos.push(p.x, p.y, p.z);
        const c = pal[Math.floor(r.next() * 3)];
        col.push(c[0], c[1], c[2]);
        sw.push(sway(p.y));
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SIDES; j++) {
        const a = start + i * (SIDES + 1) + j;
        idx.push(a, a + 1, a + SIDES + 1, a + 1, a + SIDES + 2, a + SIDES + 1);
      }
    }
  }
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hullGeo.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 1));
  hullGeo.setIndex(idx);

  // --- strokes: long flames that climb and curl, as he drew them
  const totalArea = FLAMES.reduce((a, f) => a + f.r * f.h, 0);
  const t = new THREE.Vector3();
  const lay = (w: StrokeWriter, count: number, size: { len: [number, number]; wid: [number, number]; shell: [number, number]; curl: number }) => {
    for (const f of FLAMES) {
      const share = Math.round((count * f.r * f.h) / totalArea);
      for (let k = 0; k < share; k++) {
        let s = r.next();
        while (r.next() > profile(s)) s = r.next();
        s *= 0.97;
        const th = r.next() * Math.PI * 2;
        point(f, s, th, r.range(size.shell[0], size.shell[1]), p, n);
        const a = size.curl * Math.sin(th * 2 + s * 8 + f.phase) + r.range(-0.1, 0.1);
        t.copy(up).multiplyScalar(Math.cos(a)).addScaledVector(tangent, Math.sin(a));
        t.addScaledVector(n, -t.dot(n)).normalize();
        const length = r.range(size.len[0], size.len[1]) * (0.55 + 0.45 * profile(s));
        w.add({
          p, t, n, length,
          width: r.range(size.wid[0], size.wid[1]),
          lift: r.range(0.0, 0.1) + (r.next() < 0.12 ? 0.14 : 0),
          bend: (r.next() < 0.5 ? -1 : 1) * r.range(0.1, 0.4) * size.curl,
          colour: r.pick(pal, wts),
          streak: r.pick(pal, wts),
          seed: r.next(),
          shape: Math.floor(r.next() * 8),
          sway: sway(p.y),
          tipSway: 0.05 * length,
        });
      }
    }
  };
  const coarse = new StrokeWriter();
  lay(coarse, 5600, { len: [0.9, 2.0], wid: [0.1, 0.19], shell: [0.72, 0.96], curl: 0.28 });
  const fine = new StrokeWriter();
  lay(fine, 15000, { len: [0.3, 0.75], wid: [0.035, 0.065], shell: [0.94, 1.03], curl: 0.5 });

  const group = new THREE.Group();
  const fineMesh = surfaceStrokes(fine.data(), { segments: 3, fade: [7, 12] });
  const coarseMesh = surfaceStrokes(coarse.data(), { segments: 4 });
  group.add(undercoat(hullGeo), coarseMesh, fineMesh);
  const fineGeo = fineMesh.geometry as THREE.InstancedBufferGeometry;
  const fineTotal = fineGeo.instanceCount;
  return {
    group,
    count: fineTotal + (coarseMesh.geometry as THREE.InstancedBufferGeometry).instanceCount,
    setDensity(f: number) {
      fineGeo.instanceCount = Math.floor(fineTotal * f);
    },
  };
}
