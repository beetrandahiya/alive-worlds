import * as THREE from 'three';
import { plainForms, rng } from '../../paint/strokes';
import type { StarryMeta } from './sky';
import { terrain } from './terrain';

/**
 * The village and the valley's trees, as a real place measured in metres.
 *
 * STAGE: bare forms. Plain solid shapes with flat colours, no paint yet, so
 * the layout and the sizes of things can be judged on their own.
 *
 * The church stands where the painting puts it (its foot, read off the scan,
 * followed along the line of sight to the valley floor). Everything else is
 * laid out around it: a main street running away from the viewpoint, a cross
 * street in front of the church, a back lane, houses along them, olive trees
 * to the right and behind, and a lane down from the knoll.
 *
 * Local directions: `f` points from the viewpoint to the church (away from
 * you at the start); `r` points to the right of that.
 */
const CHURCH_FOOT_PX: [number, number] = [726, 866]; // on the 1280 px wide scan
const SCAN = { w: 1280, h: 1014, horizon: 710 };

const WALLS = [[0.66, 0.7, 0.72], [0.5, 0.56, 0.64], [0.78, 0.79, 0.74], [0.42, 0.48, 0.58], [0.6, 0.58, 0.52]];
const ROOFS = [[0.17, 0.23, 0.42], [0.25, 0.34, 0.56], [0.2, 0.3, 0.36], [0.47, 0.29, 0.22], [0.36, 0.33, 0.3]];
const LIT = [0.95, 0.8, 0.28];
const DARK = [0.1, 0.13, 0.22];
const DOOR = [0.2, 0.17, 0.16];
const ROAD = [0.5, 0.5, 0.5];
const TREES = [[0.16, 0.3, 0.34], [0.2, 0.36, 0.38], [0.14, 0.25, 0.33], [0.26, 0.4, 0.36]];

interface Footprint { x: number; z: number; yaw: number; w: number; d: number }

export function buildVillage(meta: StarryMeta) {
  const r = rng(1890);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];

  // --- where the church stands
  const F = (0.5 / Math.tan(THREE.MathUtils.degToRad(meta.hfovDeg / 2))) * SCAN.w;
  const pitch = THREE.MathUtils.degToRad(meta.pitchDeg);
  const az = Math.atan2(CHURCH_FOOT_PX[0] - SCAN.w / 2, F * Math.cos(pitch));
  const el = pitch - Math.atan2(CHURCH_FOOT_PX[1] - SCAN.h / 2, F);
  let dist = 100;
  for (let i = 0; i < 40; i++) {
    const x = Math.sin(az) * dist, z = -Math.cos(az) * dist;
    dist = (1.6 - terrain(x, z)) / Math.tan(-el);
  }
  const church = new THREE.Vector2(Math.sin(az) * dist, -Math.cos(az) * dist);
  const f = new THREE.Vector2(Math.sin(az), -Math.cos(az));
  const rt = new THREE.Vector2(-f.y, f.x);
  /** A point given as metres right of, and beyond, the church. */
  const at = (right: number, beyond: number) => church.clone().addScaledVector(rt, right).addScaledVector(f, beyond);
  const baseYaw = Math.atan2(rt.y, rt.x); // a house with yaw 0 has its long side along `r`

  // --- small builders
  const tri = (a: number[], b: number[], c: number[], colour: number[]) => {
    const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      .cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]))
      .normalize();
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(n.x, n.y, n.z);
      col.push(colour[0], colour[1], colour[2]);
    }
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], colour: number[]) => {
    tri(a, b, c, colour);
    tri(a, c, d, colour);
  };
  /** Turn a point in a building's own frame (x along its length, z its depth) into the world. */
  const frame = (fp: Footprint, y0: number) => {
    const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw);
    return (x: number, y: number, z: number) => [fp.x + x * c - z * s, y0 + y, fp.z + x * s + z * c];
  };
  const groundUnder = (fp: Footprint) => {
    let lo = Infinity;
    const P = frame(fp, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = P((x * fp.w) / 2, 0, (z * fp.d) / 2);
      lo = Math.min(lo, terrain(p[0], p[2]));
    }
    return lo - 0.3;
  };
  const walls = (fp: Footprint, y0: number, h: number, colour: number[]) => {
    const P = frame(fp, y0);
    const w = fp.w / 2, d = fp.d / 2;
    const c = [[-w, -d], [w, -d], [w, d], [-w, d]];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      quad(P(a[0], 0, a[1]), P(a[0], h, a[1]), P(b[0], h, b[1]), P(b[0], 0, b[1]), colour);
    }
  };
  /** A pitched roof with its ridge along the building's length, and the two gable ends. */
  const gable = (fp: Footprint, y0: number, h: number, rise: number, roof: number[], wall: number[]) => {
    const P = frame(fp, y0);
    const w = fp.w / 2, d = fp.d / 2, o = 0.35;
    quad(P(-w - o, h - 0.25, -d - o), P(-w - o, h + rise, 0), P(w + o, h + rise, 0), P(w + o, h - 0.25, -d - o), roof);
    quad(P(w + o, h - 0.25, d + o), P(w + o, h + rise, 0), P(-w - o, h + rise, 0), P(-w - o, h - 0.25, d + o), roof);
    tri(P(-w, h, d), P(-w, h + rise, 0), P(-w, h, -d), wall);
    tri(P(w, h, -d), P(w, h + rise, 0), P(w, h, d), wall);
  };
  /** A flat panel just proud of the front or back wall (window, door). */
  const panel = (fp: Footprint, y0: number, x: number, y: number, pw: number, ph: number, side: number, colour: number[]) => {
    const P = frame(fp, y0);
    const z = side * (fp.d / 2 + 0.04);
    const a = P(x - pw / 2, y, z), b = P(x - pw / 2, y + ph, z), c = P(x + pw / 2, y + ph, z), d = P(x + pw / 2, y, z);
    if (side > 0) quad(d, c, b, a, colour);
    else quad(a, b, c, d, colour);
  };

  // --- the church: nave, tower and the tall spire he painted
  const footprints: Footprint[] = [];
  const naveC = at(-9, 6);
  const nave: Footprint = { x: naveC.x, z: naveC.y, yaw: baseYaw + Math.PI / 2, w: 22, d: 9.5 };
  const towerC = at(-9, -8);
  const tower: Footprint = { x: towerC.x, z: towerC.y, yaw: baseYaw, w: 5.4, d: 5.4 };
  {
    const y0 = groundUnder(nave);
    const stone = [0.74, 0.77, 0.78];
    walls(nave, y0, 9, stone);
    gable(nave, y0, 9, 6, ROOFS[0], stone);
    for (const side of [-1, 1]) for (const x of [-6, -1, 4]) panel(nave, y0, x, 3.2, 1.1, 3.6, side, DARK);
    walls(tower, y0, 19, stone);
    const P = frame(tower, y0);
    const t = 2.7 + 0.3, top = 19 + 27;
    const base = [[-t, -t], [t, -t], [t, t], [-t, t]];
    for (let i = 0; i < 4; i++) {
      const a = base[i], b = base[(i + 1) % 4];
      tri(P(a[0], 19, a[1]), P(0, top, 0), P(b[0], 19, b[1]), ROOFS[1]);
    }
    panel(tower, y0, 0, 0, 1.6, 2.6, -1, DOOR);
    panel(tower, y0, 0, 13, 1.0, 2.4, -1, DARK);
    footprints.push(nave, tower);
  }

  // --- streets: [from, to, half width]
  const streets: [THREE.Vector2, THREE.Vector2, number][] = [
    [at(8, -92), at(8, 78), 3.4],    // main street, past the church
    [at(-66, -20), at(92, -20), 3.2], // cross street in front of the church
    [at(50, -70), at(50, 60), 2.6],   // back lane
    [at(-40, -20), at(-40, 52), 2.6], // lane behind the church
  ];
  const distToStreet = (p: THREE.Vector2, s: [THREE.Vector2, THREE.Vector2, number]) => {
    const ab = s[1].clone().sub(s[0]);
    const t = THREE.MathUtils.clamp(p.clone().sub(s[0]).dot(ab) / ab.lengthSq(), 0, 1);
    return p.distanceTo(s[0].clone().addScaledVector(ab, t));
  };
  const clear = (fp: Footprint) => {
    const p = new THREE.Vector2(fp.x, fp.z);
    const reach = Math.hypot(fp.w, fp.d) / 2;
    for (const s of streets) if (distToStreet(p, s) < s[2] + fp.d / 2 + 0.5) return false;
    for (const o of footprints) if (p.distanceTo(new THREE.Vector2(o.x, o.z)) < reach + Math.hypot(o.w, o.d) / 2 - 1.5) return false;
    return p.distanceTo(new THREE.Vector2(towerC.x, towerC.y)) > 17; // leave the square open
  };

  // --- houses, shoulder to shoulder along the streets
  let houses = 0;
  for (const s of streets) {
    const ab = s[1].clone().sub(s[0]);
    const len = ab.length();
    const dir = ab.clone().normalize();
    const side = new THREE.Vector2(-dir.y, dir.x);
    const yaw = Math.atan2(dir.y, dir.x);
    for (const sgn of [-1, 1]) {
      let along = r.range(2, 9);
      while (along < len - 6 && houses < 38) {
        const w = r.range(7.5, 12.5), d = r.range(6.2, 8.2);
        const c = s[0].clone().addScaledVector(dir, along + w / 2).addScaledVector(side, sgn * (s[2] + d / 2 + r.range(0.6, 1.8)));
        const fp: Footprint = { x: c.x, z: c.y, yaw, w, d };
        along += w + (r.next() < 0.3 ? r.range(4, 11) : r.range(0.4, 1.6));
        if (!clear(fp)) continue;
        const y0 = groundUnder(fp);
        const tall = r.next() < 0.55;
        const h = (tall ? r.range(5.6, 6.6) : r.range(3.3, 4.2)) + 0.3;
        const wall = r.pick(WALLS), roof = r.pick(ROOFS);
        walls(fp, y0, h, wall);
        gable(fp, y0, h, r.range(2.6, 3.8), roof, wall);
        const front = -sgn; // the side that faces the street
        const lit = r.next() < 0.4;
        const n = Math.max(2, Math.round(w / 3.2));
        const doorAt = Math.floor(r.next() * n);
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + ((i + 0.5) * w) / n;
          if (i === doorAt) panel(fp, y0, x, 0.3, 1.1, 2.1, front, DOOR);
          else panel(fp, y0, x, 1.3, 0.95, 1.3, front, lit && r.next() < 0.6 ? LIT : DARK);
          if (tall) panel(fp, y0, x, 4.0, 0.9, 1.2, front, lit && r.next() < 0.35 ? LIT : DARK);
        }
        // a chimney
        const ch: Footprint = { x: fp.x + Math.cos(yaw) * (w * r.range(-0.3, 0.3)), z: fp.z + Math.sin(yaw) * (w * r.range(-0.3, 0.3)), yaw, w: 0.7, d: 0.7 };
        walls(ch, y0 + h + 1.2, 2.2, [0.3, 0.26, 0.25]);
        footprints.push(fp);
        houses++;
      }
    }
  }

  // --- roads, lying on the ground
  const strip = (pts: THREE.Vector2[], half: number, colour: number[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const side = new THREE.Vector2(-(b.y - a.y), b.x - a.x).normalize().multiplyScalar(half);
      const v = (p: THREE.Vector2, s: number) => {
        const x = p.x + side.x * s, z = p.y + side.y * s;
        return [x, terrain(x, z) + 0.06, z];
      };
      quad(v(a, -1), v(a, 1), v(b, 1), v(b, -1), colour);
    }
  };
  const cut = (a: THREE.Vector2, b: THREE.Vector2, n: number) => Array.from({ length: n + 1 }, (_, i) => a.clone().lerp(b, i / n));
  for (const s of streets) strip(cut(s[0], s[1], 40), s[2], ROAD);
  // the lane from the knoll down to the near end of the main street
  const laneEnd = at(8, -92);
  const lane: THREE.Vector2[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const p = new THREE.Vector2(9, -7).lerp(laneEnd, t);
    p.addScaledVector(new THREE.Vector2(1, 0), Math.sin(t * Math.PI) * 16 + Math.sin(t * Math.PI * 3) * 4);
    lane.push(p);
  }
  strip(lane, 1.5, [0.44, 0.44, 0.42]);

  // --- olive trees and bushes: rounded forms, 3 to 5 m tall
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const ip = ico.getAttribute('position');
  let trees = 0;
  const tree = (c: THREE.Vector2, wide: number, high: number) => {
    for (const s of streets) if (distToStreet(c, s) < s[2] + wide + 1) return;
    for (const o of footprints) if (c.distanceTo(new THREE.Vector2(o.x, o.z)) < Math.hypot(o.w, o.d) / 2 + wide) return;
    if (c.length() < 30) return;
    const y = terrain(c.x, c.y) + high * 0.5;
    const colour = r.pick(TREES);
    const turn = r.next() * 6.28;
    const v = (i: number) => {
      const x = ip.getX(i), yy = ip.getY(i), z = ip.getZ(i);
      const lump = 1 + 0.16 * Math.sin(x * 5 + turn) * Math.cos(z * 4 + yy * 3);
      const cx = x * Math.cos(turn) - z * Math.sin(turn), cz = x * Math.sin(turn) + z * Math.cos(turn);
      return [c.x + cx * wide * lump, y + yy * high * 0.55 * lump, c.y + cz * wide * lump];
    };
    for (let i = 0; i < ip.count; i += 3) tri(v(i), v(i + 1), v(i + 2), colour);
    trees++;
  };
  // groves in loose rows to the right of the village and beyond it, as he painted them
  for (let row = 0; row < 11; row++) {
    for (let k = 0; k < 16; k++) {
      const c = at(74 + k * 9.5 + r.range(-2.5, 2.5), -78 + row * 17 + r.range(-3, 3) + 6 * Math.sin(k * 0.7));
      if (r.next() < 0.8) tree(c, r.range(2.1, 3.3), r.range(3.2, 4.8));
    }
  }
  // scattered trees on the left and in gardens
  for (let k = 0; k < 70; k++) tree(at(r.range(-150, 70), r.range(-100, 110)), r.range(1.6, 2.8), r.range(2.6, 4.2));

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const group = new THREE.Group();
  group.add(plainForms(g));

  /** True inside a building: you cannot walk through walls. */
  const blocked = (x: number, z: number) => {
    for (const fp of footprints) {
      const dx = x - fp.x, dz = z - fp.z;
      const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw);
      if (Math.abs(dx * c + dz * s) < fp.w / 2 + 0.3 && Math.abs(-dx * s + dz * c) < fp.d / 2 + 0.3) return true;
    }
    return false;
  };
  return { group, blocked, houses, trees, church: { x: church.x, z: church.y, distance: dist } };
}
