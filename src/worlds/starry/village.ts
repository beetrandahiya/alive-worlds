import * as THREE from 'three';
import { plainForms, rng } from '../../paint/strokes';
import { terrain } from './terrain';

/**
 * The village, the asylum, the walled wheat field and the valley's trees, as a
 * real place measured in metres.
 *
 * STAGE: bare forms. Plain solid shapes with flat colours, no paint yet.
 *
 * - The heart of the village is the church and the twelve buildings he
 *   painted. `tools/starry/village.py` reads each off the canvas and gives it
 *   a position and size so that, from the start, it stands where he put it.
 * - Round that heart the village carries on in the manner of the real old
 *   town of Saint-Remy: a ring lane where walls once stood, houses along it.
 *   Those extra houses are only placed where the start view cannot see them
 *   (behind the cypress, or beyond the frame), so the painted view is his.
 * - Behind the start stands the asylum, Saint-Paul-de-Mausole: the men's wing
 *   with his barred upper window, and the chapel's square tower.
 * - Below the start lies the walled wheat field he saw from that window.
 */
interface Built { x: number; z: number; w: number; wall: number; rise: number; wallColour: number[]; roofColour: number[]; lit: number; gable: boolean }
interface VillageData {
  camera: { F: number; pitch: number; W: number; H: number };
  houses: Built[];
  church: { nave: Built; tower: Built; wing: Built; spireTop: number };
  trees: { x: number; z: number; r: number; h: number; colour: number[] }[];
  road: number[];
  field: number[];
}
interface Footprint { x: number; z: number; yaw: number; w: number; d: number }

const LIT = [0.93, 0.78, 0.22];
const DARK = [0.08, 0.1, 0.18];
const DOOR = [0.16, 0.14, 0.14];
const STONE = [0.5, 0.5, 0.47];

export async function buildVillage(base: string) {
  const data: VillageData = await fetch(base + 'village.json').then((r) => r.json());
  const r = rng(1890);
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const footprints: Footprint[] = [];

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
  /** A flat panel just proud of the front (+1) or back (-1) wall. */
  const panel = (fp: Footprint, y0: number, x: number, y: number, pw: number, ph: number, side: number, colour: number[]) => {
    const P = frame(fp, y0);
    const z = side * (fp.d / 2 + 0.04);
    const a = P(x - pw / 2, y, z), b = P(x - pw / 2, y + ph, z), c = P(x + pw / 2, y + ph, z), d = P(x + pw / 2, y, z);
    if (side > 0) quad(d, c, b, a, colour);
    else quad(a, b, c, d, colour);
  };
  /** Doors and windows along one long side of a house. */
  const openings = (fp: Footprint, y0: number, h: number, side: number, lit: number) => {
    const n = Math.max(2, Math.round(fp.w / 3.2));
    const doorAt = Math.floor(r.next() * n);
    const floors = Math.max(1, Math.round((h - 0.4) / 2.9));
    let lamps = lit;
    for (let i = 0; i < n; i++) {
      const x = -fp.w / 2 + ((i + 0.5) * fp.w) / n;
      for (let f = 0; f < floors; f++) {
        if (f === 0 && i === doorAt) panel(fp, y0, x, 0.3, 1.1, 2.1, side, DOOR);
        else panel(fp, y0, x, 1.3 + f * 2.9, 0.95, 1.3, side, lamps-- > 0 ? LIT : DARK);
      }
    }
  };
  /** Yaw that turns a building's long side square to the start point, so it shows as painted. */
  const facingStart = (x: number, z: number) => Math.atan2(z, x) + Math.PI / 2;
  const house = (fp: Footprint, wall: number, rise: number, wallColour: number[], roofColour: number[], lit: number, front: number) => {
    const y0 = groundUnder(fp);
    walls(fp, y0, wall + 0.3, wallColour);
    gable(fp, y0, wall + 0.3, rise, roofColour, wallColour);
    openings(fp, y0, wall, front, lit);
    const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw), k = fp.w * r.range(-0.3, 0.3);
    walls({ x: fp.x + c * k, z: fp.z + s * k, yaw: fp.yaw, w: 0.7, d: 0.7 }, y0 + wall + rise * 0.45, rise * 0.55 + 1.1, [0.2, 0.18, 0.18]);
    footprints.push(fp);
  };

  // --- two oriented rectangles overlap? (so nothing is ever built into anything else)
  const cornersOf = (fp: Footprint, grow = 0) => {
    const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw), w = fp.w / 2 + grow, d = fp.d / 2 + grow;
    return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([x, z]) => new THREE.Vector2(fp.x + x * c - z * s, fp.z + x * s + z * c));
  };
  const overlap = (a: Footprint, b: Footprint, gap: number) => {
    const A = cornersOf(a, gap / 2), B = cornersOf(b, gap / 2);
    for (const fp of [a, b]) {
      for (const ang of [fp.yaw, fp.yaw + Math.PI / 2]) {
        const ax = new THREE.Vector2(Math.cos(ang), Math.sin(ang));
        const pa = A.map((p) => p.dot(ax)), pb = B.map((p) => p.dot(ax));
        if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
      }
    }
    return true;
  };
  const overlaps = (fp: Footprint, gap: number) => footprints.some((o) => overlap(fp, o, gap));

  // --- the streets. The painted buildings stand in three rows across the
  // view; the streets run between the rows, two lanes cross them, and a lane
  // on the line of old walls rings the whole, as the boulevards ring the real
  // old town. Every street is laid where no painted building stands.
  type Road = { pts: THREE.Vector2[]; half: number };
  const V = (x: number, z: number) => new THREE.Vector2(x, z);
  const roads: Road[] = [
    { pts: [V(-78, -92), V(76, -92)], half: 2.6 },      // the front street, where the lane from the asylum arrives
    { pts: [V(-78, -126), V(88, -126)], half: 2.4 },    // between the front and middle rows
    { pts: [V(-78, -168.6), V(90, -168.6)], half: 1.9 }, // church street, between the middle row and the church's row
    { pts: [V(-8, -92), V(-8, -168.6)], half: 1.8 },    // west cross lane
    { pts: [V(41, -92), V(41, -168.6)], half: 1.8 },    // east cross lane
    { // the ring lane
      pts: [V(-78, -92), V(-84, -110), V(-84, -186), V(-70, -204), V(72, -204), V(90, -190), V(90, -108), V(76, -92)],
      half: 2.2,
    },
    // the lane from the asylum, down the outside of the field's right-hand wall, to the front street
    { pts: [V(7, -6), V(26, -16), V(41.5, -36), V(42, -84), V(41, -92)], half: 1.4 },
  ];
  const distToRoad = (p: THREE.Vector2, rd: Road) => {
    let best = Infinity;
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const a = rd.pts[i], ab = rd.pts[i + 1].clone().sub(a);
      const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
      best = Math.min(best, p.distanceTo(a.clone().addScaledVector(ab, t)));
    }
    return best;
  };
  /** Does a building stand in a street? */
  const onRoad = (fp: Footprint, gap = 0.3) => {
    const pts = cornersOf(fp);
    pts.push(V(fp.x, fp.z), ...pts.map((p, i) => p.clone().lerp(pts[(i + 1) % 4], 0.5)));
    return roads.some((rd) => pts.some((p) => distToRoad(p, rd) < rd.half + gap));
  };

  // --- the heart: what he painted, where he painted it
  const DEPTH = 6.5;
  const painted: { fp: Footprint; b: Built }[] = data.houses.map((h) => ({
    fp: { x: h.x, z: h.z, yaw: facingStart(h.x, h.z), w: h.w, d: DEPTH },
    b: h,
  }));
  const ch = data.church;
  const cyaw = facingStart(ch.nave.x, ch.nave.z);
  // the nave runs away from the start, showing its gable end, as he painted it
  const nave: Footprint = { x: ch.nave.x, z: ch.nave.z, yaw: cyaw + Math.PI / 2, w: 18, d: ch.nave.w };
  {
    const back = V(ch.nave.x, ch.nave.z).normalize().multiplyScalar(nave.w / 2 - 2.5);
    nave.x += back.x;
    nave.z += back.y;
  }
  const tw = Math.max(ch.tower.w, 4.4);
  const tower: Footprint = { x: ch.tower.x, z: ch.tower.z, yaw: cyaw, w: tw, d: tw };
  const wing: Footprint = { x: ch.wing.x, z: ch.wing.z, yaw: cyaw, w: ch.wing.w, d: DEPTH };
  // He drew neighbours touching or overlapping. Standing in a real street they
  // become a terrace: each gives up a little width until none is inside another.
  const fixed = [nave, tower, wing, ...painted.map((q) => q.fp)];
  for (let pass = 0; pass < 12; pass++) {
    for (let i = 0; i < fixed.length; i++) {
      for (let j = i + 1; j < fixed.length; j++) {
        if (!overlap(fixed[i], fixed[j], 0.05)) continue;
        for (const f of [fixed[i], fixed[j]]) if (f !== nave && f !== tower) f.w *= 0.93;
        if (fixed[i] === nave || fixed[j] === nave) nave.d *= 0.96;
      }
    }
  }
  for (const q of painted) {
    if (onRoad(q.fp, 0)) q.fp.d = 5.2; // a shallow house rather than one in the street
    house(q.fp, q.b.wall, q.b.rise, q.b.wallColour, q.b.roofColour, q.b.lit, 1);
  }
  {
    const y0 = groundUnder(nave);
    walls(nave, y0, ch.nave.wall, ch.nave.wallColour);
    gable(nave, y0, ch.nave.wall, ch.nave.rise, ch.nave.roofColour, ch.nave.wallColour);
    for (const side of [-1, 1]) for (const x of [-5, 0, 5]) panel(nave, y0, x, 2.6, 1.0, 3.0, side, DARK);
    const towerH = ch.tower.wall;
    walls(tower, y0, towerH, ch.tower.wallColour);
    const P = frame(tower, y0);
    const t = tower.w / 2 + 0.25;
    const cs = [[-t, -t], [t, -t], [t, t], [-t, t]];
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      tri(P(a[0], towerH, a[1]), P(0, ch.spireTop, 0), P(b[0], towerH, b[1]), ch.tower.roofColour);
    }
    panel(tower, y0, 0, 0, 1.5, 2.5, 1, DOOR);
    panel(tower, y0, 0, towerH * 0.62, 0.9, 2.2, 1, DARK);
    walls(wing, y0, ch.wing.wall, ch.wing.wallColour);
    gable(wing, y0, ch.wing.wall, ch.wing.rise, ch.wing.roofColour, ch.wing.wallColour);
    footprints.push(nave, tower, wing);
  }

  // --- can the start view see a place? (inside the frame and not behind the cypress)
  const cam = data.camera;
  const seenFromStart = (x: number, y: number, z: number) => {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const dy = y - 1.6;
    const fwd = -z * cp + dy * sp, upv = dy * cp + z * sp;
    if (fwd <= 1) return false;
    const px = cam.W / 2 + (cam.F * x) / fwd, py = cam.H / 2 - (cam.F * upv) / fwd;
    if (px < -30 || px > cam.W + 30 || py < 0 || py > cam.H + 40) return false;
    return !(px > 185 && px < 520); // the cypress stands in front of this part
  };

  // --- the walled wheat field, directly below the start, as it lay below
  // his window (letter 776: "an enclosed square of wheat"). The slope here
  // falls faster than the bottom of the painted view, so none of it shows
  // from the start. The far wall slants away to the right, as he drew it;
  // a small stone hut stands at its right-hand end. Mid-June 1889: ripening
  // wheat, "warm tones of a bread crust", flattened in places by the storm.
  {
    const c = [V(-42, -42), V(38, -42), V(38, -88), V(-42, -76)]; // near-left, near-right, far-right, far-left
    const at = (u: number, v: number) => {
      const near = c[0].clone().lerp(c[1], u), far = c[3].clone().lerp(c[2], u);
      return near.lerp(far, v);
    };
    const WHEAT = [0.43, 0.37, 0.2], LAID = [0.33, 0.29, 0.31]; // dull yellow-ochre and violet, as in his moonrise painting of this field
    const N = 16;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const g = (u: number, v: number) => {
          const p = at(u / N, v / N);
          return [p.x, terrain(p.x, p.y) + 0.45, p.y]; // standing wheat, knee high for now
        };
        const flat = Math.sin(i * 0.9 + 1.3) * Math.cos(j * 0.7 + i * 0.35) > 0.35; // where the storm laid it down
        quad(g(i, j), g(i, j + 1), g(i + 1, j + 1), g(i + 1, j), (flat ? LAID : WHEAT).map((v) => v * r.range(0.93, 1.07)));
      }
    }
    // Walls on three sides only: the near side was closed by the asylum itself.
    // About 1.2 m high, so you can see the wheat over it from the lane, which
    // runs a little below it. (A photograph of today's wall suggests 2 to
    // 2.5 m; no 1889 figure was found. Owner chose to look over the wall.)
    for (let i = 1; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      const len = a.distanceTo(b), n = Math.ceil(len / 3);
      for (let k = 0; k < n; k++) {
        const m = a.clone().lerp(b, (k + 0.5) / n);
        const seg: Footprint = { x: m.x, z: m.y, yaw: Math.atan2(b.y - a.y, b.x - a.x), w: len / n + 0.15, d: 0.55 };
        const y0 = terrain(m.x, m.y) - 0.6;
        // Beside the lane, which lies lower, the wall is kept to chest height as seen from the lane.
        const hgt = i === 1 ? Math.max(1.0, terrain(m.x + 3.6, m.y) + 1.15 - y0) : 1.8;
        walls(seg, y0, hgt, STONE);
        const P = frame(seg, y0 + hgt);
        quad(P(-seg.w / 2, 0, -0.28), P(-seg.w / 2, 0, 0.28), P(seg.w / 2, 0, 0.28), P(seg.w / 2, 0, -0.28), STONE);
        footprints.push(seg);
      }
    }
    const hut: Footprint = { x: 33.5, z: -83.5, yaw: Math.atan2(c[2].y - c[3].y, c[2].x - c[3].x), w: 4.2, d: 3.2 };
    const yh = groundUnder(hut);
    walls(hut, yh, 2.7, STONE);
    gable(hut, yh, 2.7, 1.1, [0.4, 0.27, 0.22], STONE);
    panel(hut, yh, 0, 0.3, 0.9, 1.8, -1, DOOR);
    footprints.push(hut);
  }

  // --- the rest of the village: houses shoulder to shoulder along the same
  // streets, their doors on the street, only where the start view cannot see
  // them, and never in a street or inside another building
  const wallsBorrowed = data.houses.map((h) => h.wallColour);
  const roofsBorrowed = data.houses.map((h) => h.roofColour);
  let extra = 0;
  for (const rd of roads) {
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const a = rd.pts[i], ab = rd.pts[i + 1].clone().sub(a);
      const len = ab.length(), dir = ab.clone().normalize(), side = V(-dir.y, dir.x);
      const yaw = Math.atan2(dir.y, dir.x);
      for (const sgn of [-1, 1]) {
        let along = r.range(1, 5);
        while (along < len - 5 && extra < 26) {
          const w = r.range(7, 11.5), d = r.range(6, 7.6);
          const c = a.clone().addScaledVector(dir, along + w / 2).addScaledVector(side, sgn * (rd.half + d / 2 + 0.5));
          const fp: Footprint = { x: c.x, z: c.y, yaw, w, d };
          along += w + (r.next() < 0.25 ? r.range(3, 9) : 0.25);
          const wallH = r.next() < 0.55 ? r.range(5.4, 6.4) : r.range(3.2, 4.1);
          if (seenFromStart(c.x, terrain(c.x, c.y) + wallH + 2, c.y) || overlaps(fp, 0.2) || onRoad(fp)) continue;
          house(fp, wallH, r.range(1.6, 3.0), r.pick(wallsBorrowed), r.pick(roofsBorrowed), r.next() < 0.35 ? 1 : 0, -sgn);
          extra++;
        }
      }
    }
  }

  // --- streets and the lane, lying on the ground
  const strip = (pts: THREE.Vector2[], half: number, colour: number[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / 5));
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n), q = a.clone().lerp(b, (k + 1) / n);
        const side = V(-(q.y - p.y), q.x - p.x).normalize().multiplyScalar(half);
        const v = (m: THREE.Vector2, sg: number) => {
          const x = m.x + side.x * sg, z = m.y + side.y * sg;
          return [x, terrain(x, z) + 0.06, z];
        };
        quad(v(p, -1), v(p, 1), v(q, 1), v(q, -1), colour);
      }
    }
  };
  const roadColour = data.road.map((c) => c * 0.8);
  for (const rd of roads) strip(rd.pts, rd.half, roadColour);

  // --- trees: the ones he painted, where he painted them, then groves beyond the frame
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const ip = ico.getAttribute('position');
  const treeAt: THREE.Vector3[] = [];
  const tree = (x: number, z: number, wide: number, high: number, colour: number[]) => {
    const y = terrain(x, z) + high * 0.5;
    const turn = r.next() * 6.28;
    const v = (i: number) => {
      const px = ip.getX(i), py = ip.getY(i), pz = ip.getZ(i);
      const lump = 1 + 0.16 * Math.sin(px * 5 + turn) * Math.cos(pz * 4 + py * 3);
      const cx = px * Math.cos(turn) - pz * Math.sin(turn), cz = px * Math.sin(turn) + pz * Math.cos(turn);
      return [x + cx * wide * lump, y + py * high * 0.55 * lump, z + cz * wide * lump];
    };
    for (let i = 0; i < ip.count; i += 3) tri(v(i), v(i + 1), v(i + 2), colour);
    treeAt.push(new THREE.Vector3(x, 0, z));
  };
  for (const t of data.trees) {
    // a painted tree keeps its place unless a street or house needs it; then it steps aside
    let x = t.x, z = t.z;
    for (let k = 0; k < 14; k++) {
      const spot: Footprint = { x, z, yaw: 0, w: t.r * 1.2, d: t.r * 1.2 };
      if (!overlaps(spot, 0) && !onRoad(spot, 0)) break;
      const a = k * 2.4;
      x = t.x + Math.cos(a) * (1.5 + k * 0.9);
      z = t.z + Math.sin(a) * (1.5 + k * 0.9);
    }
    tree(x, z, t.r, t.h, t.colour.map((c) => c * 0.85));
  }
  const greens = data.trees.slice(0, 5).map((t) => t.colour.map((c) => c * 0.8));
  for (let k = 0; k < 420 && treeAt.length < 190; k++) {
    const a = r.range(0, Math.PI * 2), d = r.range(110, 330);
    const x = Math.sin(a) * d, z = -Math.cos(a) * d;
    const wide = r.range(2.2, 4.2), high = r.range(3.4, 6);
    if (seenFromStart(x, terrain(x, z) + high, z)) continue;
    const spot: Footprint = { x, z, yaw: 0, w: wide * 2, d: wide * 2 };
    if (overlaps(spot, 1) || onRoad(spot, 0.5) || treeAt.some((t) => Math.hypot(t.x - x, t.z - z) < wide * 2.2)) continue;
    tree(x, z, wide, high, r.pick(greens));
  }

  // --- the asylum behind the start: the men's wing with his window, and the chapel tower
  {
    const wing: Footprint = { x: 4, z: 18, yaw: 0, w: 84, d: 12 }; // the men's east wing measures about 84 x 12 m on the map
    const y0 = groundUnder(wing);
    const pale = [0.5, 0.5, 0.46];
    // two storeys under a low tiled roof; his room was on the upper one
    walls(wing, y0, 8.6, pale);
    gable(wing, y0, 8.6, 2.4, [0.33, 0.27, 0.24], pale);
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 21; i++) {
        const x = -40 + i * 4;
        const his = f === 1 && i === 9; // the lit upper window, straight behind the start
        panel(wing, y0, x, 1.5 + f * 3.9, 1.1, 1.9, -1, his ? LIT : DARK);
        panel(wing, y0, x, 1.5 + f * 3.9, 1.1, 1.9, 1, DARK);
      }
    }
    const chapel: Footprint = { x: 58, z: 28, yaw: Math.PI / 2, w: 24, d: 10 };
    const yc = groundUnder(chapel);
    walls(chapel, yc, 9, pale);
    gable(chapel, yc, 9, 3, [0.33, 0.27, 0.24], pale);
    const belfry: Footprint = { x: 50, z: 22, yaw: 0, w: 6, d: 6 };
    walls(belfry, yc, 21, pale);
    const P = frame(belfry, yc);
    const t = 3.3;
    const cs = [[-t, -t], [t, -t], [t, t], [-t, t]];
    for (let i = 0; i < 4; i++) tri(P(cs[i][0], 21, cs[i][1]), P(0, 26, 0), P(cs[(i + 1) % 4][0], 21, cs[(i + 1) % 4][1]), STONE);
    for (const side of [-1, 1]) panel(belfry, yc, 0, 15.5, 1.6, 2.6, side, DARK);
    footprints.push(wing, chapel, belfry);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const group = new THREE.Group();
  group.add(plainForms(g));

  /** True inside a building or wall: you cannot walk through it. */
  const blocked = (x: number, z: number) => {
    for (const fp of footprints) {
      const dx = x - fp.x, dz = z - fp.z;
      const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw);
      if (Math.abs(dx * c + dz * s) < fp.w / 2 + 0.3 && Math.abs(-dx * s + dz * c) < fp.d / 2 + 0.3) return true;
    }
    return false;
  };
  return { group, blocked, houses: data.houses.length + extra, trees: treeAt.length };
}
