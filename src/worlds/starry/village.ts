import { VER } from '../../version';
import * as THREE from 'three';
import { plainForms, rng, StrokeWriter, surfaceStrokes } from '../../paint/strokes';
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
interface Built { x: number; z: number; w: number; wall: number; rise: number; wallColour: number[]; roofColour: number[]; lit: number; gable: boolean; wallPal: number[][]; roofPal: number[][]; outline: number[]; wallRun: number[]; roofRun: number[] }
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
  const data: VillageData = await fetch(base + 'village.json' + VER).then((r) => r.json());
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
  /** The highest ground under a building: its floor goes here, so no storey is ever buried. */
  const groundOver = (fp: Footprint) => {
    let hi = -Infinity;
    const P = frame(fp, 0);
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 2; j++) {
        const p = P((i / 8 - 0.5) * fp.w, 0, (j / 2 - 0.5) * fp.d);
        hi = Math.max(hi, terrain(p[0], p[2]));
      }
    }
    return hi;
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
  /** Openings of the house being built, for the painter: centre x, base y, width, height, colour. */
  let opened: number[][] = [];
  /** Doors and windows along one long side of a house. */
  const openings = (fp: Footprint, y0: number, h: number, side: number, lit: number) => {
    const n = Math.max(2, Math.round(fp.w / 3.2));
    const doorAt = Math.floor(r.next() * n);
    const floors = Math.max(1, Math.round((h - 0.4) / 2.9));
    let lamps = lit;
    for (let i = 0; i < n; i++) {
      const x = -fp.w / 2 + ((i + 0.5) * fp.w) / n;
      for (let f = 0; f < floors; f++) {
        if (f === 0 && i === doorAt) {
          panel(fp, y0, x, 0.3, 1.1, 2.1, side, DOOR);
          opened.push([x, 0.3, 1.1, 2.1, ...DOOR]);
        } else {
          const cl = lamps-- > 0 ? LIT : DARK;
          panel(fp, y0, x, 1.3 + f * 2.9, 0.95, 1.3, side, cl);
          opened.push([x, 1.3 + f * 2.9, 0.95, 1.3, ...cl]);
        }
      }
    }
  };
  /** Yaw that turns a building's long side square to the start point, so it shows as painted. */
  const facingStart = (x: number, z: number) => Math.atan2(z, x) + Math.PI / 2;
  // ---------------------------------------------------------------- paint
  // A building is painted as he painted: a broken dark line round its edges,
  // a few broad strokes on each plane, and, close to you, fine strokes over
  // them. Every stroke is a real raised stroke placed once; none lie in rows.
  // Colours are single strokes' colours taken from his paint of that building.
  // Broad strokes and lines are always drawn. Each building's fine strokes are
  // a separate set, drawn only while you are near it.
  const outlineCoat = new StrokeWriter();
  const broadCoat = new StrokeWriter();
  const fineSets: { w: StrokeWriter; x: number; z: number; reach: number }[] = [];
  let fineCoat = new StrokeWriter();
  let ink = [0.08, 0.1, 0.2];
  /** Start painting a building: its own fine set, and its own dark line (his, lifted toward the blue he used). */
  const beginPaint = (b: Built, x: number, z: number, reach: number) => {
    fineCoat = new StrokeWriter();
    fineSets.push({ w: fineCoat, x, z, reach });
    ink = b.outline;
  };
  interface Plane { o: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; n: THREE.Vector3; w: number; h: number; inside?: (a: number, b: number) => boolean }
  const plane = (a: THREE.Vector3, bb: THREE.Vector3, c: THREE.Vector3, inside?: Plane['inside'], outward?: THREE.Vector3): Plane => {
    const u = bb.clone().sub(a), v = c.clone().sub(a);
    const n = u.clone().cross(v).normalize();
    if (outward ? n.dot(outward) < 0 : n.y < -0.2) n.negate(); // the paint goes on the outer, upper side
    return { o: a, u: u.clone().normalize(), v: v.clone().normalize(), n, w: u.length(), h: v.length(), inside };
  };
  const lay = (out: StrokeWriter, pl: Plane, a: number, c: number, dir: number, len: number, wid: number, colour: number[], streak: number[], rise_: number) => {
    const t = pl.u.clone().multiplyScalar(Math.cos(dir)).addScaledVector(pl.v, Math.sin(dir));
    const root = pl.o.clone().addScaledVector(pl.u, a).addScaledVector(pl.v, c).addScaledVector(t, -len / 2).addScaledVector(pl.n, rise_);
    out.add({ p: root, t, n: pl.n, length: len, width: wid, lift: 0, bend: r.range(-0.07, 0.07), colour, streak, seed: r.next(), shape: Math.floor(r.next() * 8), sway: 0, tipSway: 0 });
  };
  /**
   * Cover a plane with strokes running at `dir` (0 = along the plane's first
   * edge), each turned a little by `loose`. A stroke near an edge is shortened
   * to stay on the plane, as a brush stops at the line.
   */
  const fill = (out: StrokeWriter, pl: Plane, pal: number[][], dir: number, loose: number, len: [number, number], wid: [number, number], cover: number, rise_: number) => {
    const count = Math.ceil((pl.w * pl.h * cover) / (((len[0] + len[1]) / 2) * ((wid[0] + wid[1]) / 2)));
    for (let i = 0; i < count; i++) {
      const a = r.range(0.04, pl.w - 0.04), c = r.range(0.04, pl.h - 0.04);
      if (pl.inside && !pl.inside(a, c)) continue;
      const d = dir + r.range(-loose, loose);
      const ca = Math.abs(Math.cos(d)) + 1e-3, sa = Math.abs(Math.sin(d)) + 1e-3;
      const room = 2 * Math.min(Math.min(a, pl.w - a) / ca, Math.min(c, pl.h - c) / sa);
      const want = r.range(len[0], len[1]);
      const L = Math.min(want, room);
      if (L < want * 0.3) continue;
      lay(out, pl, a, c, d, L, r.range(wid[0], wid[1]) * Math.min(1, 0.5 + (0.5 * L) / want), r.pick(pal), r.pick(pal), rise_ + r.range(0, 0.012));
    }
  };
  /** His dark line: heavy, nearly black, drawn in overlapping strokes from one point of a plane to another. */
  const line = (pl: Plane, a0: number, c0: number, a1: number, c1: number, wid = 0.2) => {
    const L = Math.hypot(a1 - a0, c1 - c0), dir = Math.atan2(c1 - c0, a1 - a0);
    const n = Math.max(1, Math.round(L / 1.6));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      lay(outlineCoat, pl, a0 + (a1 - a0) * k + r.range(-0.03, 0.03), c0 + (c1 - c0) * k + r.range(-0.03, 0.03), dir + r.range(-0.03, 0.03),
        (L / n) * r.range(1.1, 1.3), wid * r.range(0.8, 1.25), ink.map((x) => x * r.range(0.85, 1.15)), ink, 0.075);
    }
  };
  const paintBox = (fp: Footprint, y0: number, wallH: number, rise: number, front: number, b: Built, roofed = true) => {
    const P = (x: number, y: number, z: number) => new THREE.Vector3(...frame(fp, y0)(x, y, z));
    const w = fp.w / 2, d = fp.d / 2;
    const slope = Math.hypot(d + 0.35, rise + 0.25);
    const ends = (a: number, c: number) => c < wallH + rise * (1 - Math.abs(a / d - 1));
    const wallsP = [
      plane(P(-w, 0, d), P(w, 0, d), P(-w, wallH, d)),
      plane(P(w, 0, -d), P(-w, 0, -d), P(w, wallH, -d)),
      plane(P(w, 0, d), P(w, 0, -d), P(w, wallH + rise, d), ends), // the two ends, wall and gable together
      plane(P(-w, 0, -d), P(-w, 0, d), P(-w, wallH + rise, -d), ends),
    ];
    // Strokes run the way his run on this very building, measured on the
    // canvas (village.py): upright on the church, level on the low houses,
    // steeply slanted on the striped roofs. Where his strokes agree less, ours
    // wander more.
    const wallDir = b.wallRun[0], wallLoose = 0.1 + 0.5 * (1 - b.wallRun[1]);
    const roofDir = -b.roofRun[0], roofLoose = 0.06 + 0.3 * (1 - b.roofRun[1]);
    for (const pl of wallsP) {
      fill(broadCoat, pl, b.wallPal, wallDir, wallLoose * 0.6, [1.5, 2.6], [0.45, 0.75], 1.6, 0.03);
      fill(fineCoat, pl, b.wallPal, wallDir, wallLoose, [0.3, 0.62], [0.09, 0.17], 1.3, 0.05);
      line(pl, 0.06, 0, 0.06, wallH);
      line(pl, pl.w - 0.06, 0, pl.w - 0.06, wallH);
    }
    if (roofed) {
      const roofsP = [
        plane(P(-w - 0.35, wallH + rise, 0), P(w + 0.35, wallH + rise, 0), P(-w - 0.35, wallH - 0.25, d + 0.35)),
        plane(P(w + 0.35, wallH + rise, 0), P(-w - 0.35, wallH + rise, 0), P(w + 0.35, wallH - 0.25, -d - 0.35)),
      ];
      for (const pl of roofsP) {
        // roofs: long strokes from ridge to eave, as he striped them
        fill(broadCoat, pl, b.roofPal, roofDir, roofLoose * 0.5, [slope * 0.8, slope * 1.3], [0.4, 0.75], 1.7, 0.03);
        fill(fineCoat, pl, b.roofPal, roofDir, roofLoose, [0.35, 0.8], [0.09, 0.17], 1.3, 0.05);
        line(pl, 0, 0.06, pl.w, 0.06, 0.24);          // the ridge
        line(pl, 0, pl.h - 0.08, pl.w, pl.h - 0.08);   // the eave
        line(pl, 0.08, 0, 0.08, pl.h);
        line(pl, pl.w - 0.08, 0, pl.w - 0.08, pl.h);
      }
    }
    // doors and windows: his few strokes of colour, ringed in the dark line
    const face = wallsP[front > 0 ? 0 : 1];
    for (const [x, y, ow, oh, cr, cg, cb] of opened) {
      const a = front > 0 ? x + w : w - x;
      for (let i = 0; i < 4; i++) {
        const jit = r.range(0.85, 1.12);
        lay(broadCoat, face, a + r.range(-0.3, 0.3) * ow, y + oh / 2, Math.PI / 2 + r.range(-0.1, 0.1), oh * 0.95, ow * 0.42, [cr * jit, cg * jit, cb * jit], [cr, cg, cb], 0.13);
      }
      line(face, a - ow / 2, y, a - ow / 2, y + oh, 0.11);
      line(face, a + ow / 2, y, a + ow / 2, y + oh, 0.1);
      line(face, a - ow / 2, y + oh, a + ow / 2, y + oh, 0.1);
    }
    opened = [];
  };

  const house = (fp: Footprint, wall: number, rise: number, wallColour: number[], roofColour: number[], lit: number, front: number, paint?: Built) => {
    const y0 = groundUnder(fp);
    opened = [];
    walls(fp, y0, wall + 0.3, wallColour);
    gable(fp, y0, wall + 0.3, rise, roofColour, wallColour);
    openings(fp, y0, wall, front, lit);
    const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw), k = fp.w * r.range(-0.3, 0.3);
    walls({ x: fp.x + c * k, z: fp.z + s * k, yaw: fp.yaw, w: 0.7, d: 0.7 }, y0 + wall + rise * 0.45, rise * 0.55 + 1.1, [0.2, 0.18, 0.18]);
    if (paint) {
      beginPaint(paint, fp.x, fp.z, Math.hypot(fp.w, fp.d) / 2);
      paintBox(fp, y0, wall + 0.3, rise, front, paint);
    }
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
    { pts: [V(7, -6), V(26, -16), V(40.4, -36), V(40.4, -84), V(41, -92)], half: 1.3 },
  ];
  // Old lanes are never ruled lines. Every street is cut into short lengths
  // and each point drifts a little by where it lies, so streets wander and
  // still meet exactly at their junctions. The lane beside the field wanders less.
  const drift = (p: THREE.Vector2, k: number) =>
    V(
      p.x + k * (1.5 * Math.sin(p.y * 0.105 + 1.3) + 0.9 * Math.sin(p.y * 0.043 + p.x * 0.031)),
      p.y + k * (1.5 * Math.sin(p.x * 0.088 + 0.7) + 0.9 * Math.sin(p.x * 0.039 + p.y * 0.027 + 2.0)),
    );
  roads.forEach((rd, i) => {
    const k = i === roads.length - 1 ? 0.12 : 1;
    const out: THREE.Vector2[] = [];
    for (let j = 0; j < rd.pts.length - 1; j++) {
      const n = Math.max(1, Math.round(rd.pts[j].distanceTo(rd.pts[j + 1]) / 5));
      for (let m = 0; m < n; m++) out.push(drift(rd.pts[j].clone().lerp(rd.pts[j + 1], m / n), k));
    }
    out.push(drift(rd.pts[rd.pts.length - 1], k));
    rd.pts = out;
  });
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
    // every building he painted is painted; the houses he did not paint are still plain
    house(q.fp, q.b.wall, q.b.rise, q.b.wallColour, q.b.roofColour, q.b.lit, 1, q.b);
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
    // the church, painted: nave, tower, spire and wing as one building
    opened = [];
    beginPaint(ch.nave, tower.x, tower.z, 16);
    paintBox(nave, y0, ch.nave.wall, ch.nave.rise, 1, ch.nave);
    ink = ch.tower.outline;
    paintBox(tower, y0, ch.tower.wall, 0, 1, ch.tower, false);
    {
      const PT = (x: number, y: number, z: number) => new THREE.Vector3(...frame(tower, y0)(x, y, z));
      const tt = tower.w / 2 + 0.25, apex = PT(0, ch.spireTop, 0);
      const c4 = [[-tt, -tt], [tt, -tt], [tt, tt], [-tt, tt]];
      for (let i = 0; i < 4; i++) {
        const a = PT(c4[i][0], ch.tower.wall, c4[i][1]), b = PT(c4[(i + 1) % 4][0], ch.tower.wall, c4[(i + 1) % 4][1]);
        const mid = a.clone().lerp(b, 0.5);
        const side = a.distanceTo(b), hgt = mid.distanceTo(apex);
        const pl = plane(a, b, a.clone().add(apex).sub(mid), (aa, cc) => Math.abs(aa - side / 2) < (side / 2) * (1 - cc / hgt), mid.clone().sub(PT(0, ch.tower.wall, 0)));
        fill(broadCoat, pl, ch.tower.roofPal, Math.PI / 2, 0.05, [3.5, 7], [0.35, 0.6], 1.6, 0.03);
        fill(fineCoat, pl, ch.tower.roofPal, Math.PI / 2, 0.12, [0.4, 0.9], [0.09, 0.15], 1.3, 0.05);
      }
    }
    paintBox(wing, y0, ch.wing.wall, ch.wing.rise, 1, ch.wing);
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
          return [p.x, terrain(p.x, p.y) + 0.3, p.y]; // standing wheat, shin high for now
        };
        const flat = Math.sin(i * 0.9 + 1.3) * Math.cos(j * 0.7 + i * 0.35) > 0.35; // where the storm laid it down
        quad(g(i, j), g(i, j + 1), g(i + 1, j + 1), g(i + 1, j), (flat ? LAID : WHEAT).map((v) => v * r.range(0.93, 1.07)));
      }
    }
    // Walls on three sides only: the near side was closed by the asylum itself.
    // One continuous low wall that rides the ground, as he painted it: pale
    // blue-grey, about waist high above the field all the way round (F720, F735).
    const WALL = [0.4, 0.42, 0.5];
    for (let i = 1; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      const len = a.distanceTo(b), n = Math.ceil(len / 1.2);
      const nrm = V(-(b.y - a.y), b.x - a.x).normalize().multiplyScalar(0.28);
      const post = (t: number) => {
        const m = a.clone().lerp(b, t);
        const g = terrain(m.x, m.y);
        const top = g + 0.95 + 0.06 * Math.sin(t * len * 0.9);
        return { m, lo: g - 0.6, top };
      };
      for (let k = 0; k < n; k++) {
        const p = post(k / n), q = post((k + 1) / n);
        for (const sg of [-1, 1]) {
          quad(
            [p.m.x + nrm.x * sg, p.lo, p.m.y + nrm.y * sg], [p.m.x + nrm.x * sg, p.top, p.m.y + nrm.y * sg],
            [q.m.x + nrm.x * sg, q.top, q.m.y + nrm.y * sg], [q.m.x + nrm.x * sg, q.lo, q.m.y + nrm.y * sg], WALL,
          );
        }
        quad(
          [p.m.x - nrm.x, p.top, p.m.y - nrm.y], [p.m.x + nrm.x, p.top, p.m.y + nrm.y],
          [q.m.x + nrm.x, q.top, q.m.y + nrm.y], [q.m.x - nrm.x, q.top, q.m.y - nrm.y], WALL.map((v) => v * 1.12),
        );
      }
      for (let k = 0; k < Math.ceil(len / 4); k++) { // you cannot walk through it
        const m = a.clone().lerp(b, (k + 0.5) / Math.ceil(len / 4));
        footprints.push({ x: m.x, z: m.y, yaw: Math.atan2(b.y - a.y, b.x - a.x), w: len / Math.ceil(len / 4) + 0.2, d: 0.56 });
      }
    }
    const hut: Footprint = { x: 33.5, z: -83.5, yaw: Math.atan2(c[2].y - c[3].y, c[2].x - c[3].x), w: 4.2, d: 3.2 };
    const yh = groundUnder(hut);
    walls(hut, yh, 2.7, STONE);
    gable(hut, yh, 2.7, 1.1, [0.42, 0.2, 0.15], STONE); // a red tiled roof, as in F720
    panel(hut, yh, 0, 0.3, 0.9, 1.8, -1, DOOR);
    footprints.push(hut);
  }

  // --- the rest of the village: houses shoulder to shoulder along the same
  // streets, their doors on the street, only where the start view cannot see
  // them, and never in a street or inside another building
  const wallsBorrowed = data.houses.map((h) => h.wallColour);
  const roofsBorrowed = data.houses.map((h) => h.roofColour);
  let extra = 0;
  for (const rd of roads.slice(0, -1)) {
    const cum = [0];
    for (let i = 1; i < rd.pts.length; i++) cum.push(cum[i - 1] + rd.pts[i].distanceTo(rd.pts[i - 1]));
    const len = cum[cum.length - 1];
    /** The street's position and heading after walking `d` metres along it. */
    const along = (d: number) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const a = rd.pts[i - 1], b = rd.pts[i];
      const dir = b.clone().sub(a).normalize();
      return { p: a.clone().lerp(b, (d - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-3)), dir };
    };
    for (const sgn of [-1, 1]) {
      let d0 = r.range(1, 5);
      while (d0 < len - 5 && extra < 26) {
        const w = r.range(7, 11.5), d = r.range(6, 7.6);
        const { p: on, dir } = along(d0 + w / 2);
        const c = on.clone().addScaledVector(V(-dir.y, dir.x), sgn * (rd.half * 1.2 + d / 2 + 0.6));
        const fp: Footprint = { x: c.x, z: c.y, yaw: Math.atan2(dir.y, dir.x), w, d };
        d0 += w + (r.next() < 0.25 ? r.range(3, 9) : 0.3);
        const wallH = r.next() < 0.55 ? r.range(5.4, 6.4) : r.range(3.2, 4.1);
        if (seenFromStart(c.x, terrain(c.x, c.y) + wallH + 2, c.y) || overlaps(fp, 0.2) || onRoad(fp)) continue;
        house(fp, wallH, r.range(1.6, 3.0), r.pick(wallsBorrowed), r.pick(roofsBorrowed), r.next() < 0.35 ? 1 : 0, -sgn);
        extra++;
      }
    }
  }

  // --- streets and the lane, lying on the ground
  const strip = (pts: THREE.Vector2[], half: number, colour: number[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / 2.5));
      for (let k = 0; k < n; k++) {
        const p = a.clone().lerp(b, k / n), q = a.clone().lerp(b, (k + 1) / n);
        const side = V(-(q.y - p.y), q.x - p.x).normalize().multiplyScalar(half);
        const v = (m: THREE.Vector2, sg: number) => {
          // each edge wanders on its own, so the street is wider here, narrower there
          const e = 1 + 0.2 * Math.sin(m.x * 0.31 + m.y * 0.23 + sg * 1.7) + 0.1 * Math.sin(m.x * 0.83 - m.y * 0.61 + sg);
          const x = m.x + side.x * sg * e, z = m.y + side.y * sg * e;
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

  // --- the asylum behind the start, from his own paintings of it.
  // The men's wing follows "Hospital at Saint-Remy" (1889): yellow-ochre
  // walls, two storeys, tall pale windows with green shutters, a red tiled
  // roof, a central door between pilasters with a balcony above. The chapel
  // follows "View of the Asylum and Chapel" (F803): blue-grey walls and
  // roofs, a tall nave with a lower aisle and a rounded east end, and a short
  // square tower with paired openings under a pyramid roof. Colours are his
  // daytime ones brought down for night.
  {
    const OCHRE = [0.5, 0.42, 0.23], TILE = [0.42, 0.17, 0.12], SHUTTER = [0.24, 0.4, 0.3], TRIM = [0.56, 0.52, 0.4];
    const wing: Footprint = { x: 4, z: 18, yaw: 0, w: 84, d: 12 }; // about 84 x 12 m on the map
    const y0 = groundOver(wing) + 0.35;
    walls(wing, groundUnder(wing), y0 - groundUnder(wing), TRIM.map((v) => v * 0.7)); // a stone base where the ground falls away
    walls(wing, y0, 8.6, OCHRE);
    gable(wing, y0, 8.6, 2.2, TILE, OCHRE);
    for (const side of [-1, 1]) {
      panel(wing, y0, 0, 4.25, 84, 0.22, side, TRIM); // the band between the storeys
      for (let f = 0; f < 2; f++) {
        for (let i = 0; i < 21; i++) {
          const x = -40 + i * 4;
          if (f === 0 && i === 10) continue; // the door
          const his = side === -1 && f === 1 && i === 8;
          const y = 1.3 + f * 4.0;
          panel(wing, y0, x, y - 0.12, 1.5, 2.34, side, TRIM);
          panel({ ...wing, d: wing.d + 0.06 }, y0, x, y, 1.15, 2.1, side, his ? LIT : DARK);
          for (const sh of [-1, 1]) panel({ ...wing, d: wing.d + 0.06 }, y0, x + sh * 1.05, y, 0.55, 2.1, side, SHUTTER);
        }
      }
      // the entrance: pilasters, an arched door, a balcony above
      panel(wing, y0, 0, 0.2, 3.6, 3.9, side, TRIM);
      panel({ ...wing, d: wing.d + 0.08 }, y0, 0, 0.2, 1.5, 3.0, side, DOOR);
      panel({ ...wing, d: wing.d + 1.2 }, y0, 0, 4.3, 4.2, 0.95, side, [0.2, 0.2, 0.22]);
    }
    // the chapel, to the right of the wing
    const GREY = [0.36, 0.43, 0.42], SLATE = [0.27, 0.34, 0.4];
    const nave: Footprint = { x: 62, z: 30, yaw: Math.PI / 2, w: 26, d: 9 };
    const yc = Math.max(groundOver(nave), groundOver({ x: 55.5, z: 30, yaw: Math.PI / 2, w: 22, d: 5 })) + 0.3;
    for (const b of [nave, { x: 55.5, z: 30, yaw: Math.PI / 2, w: 22, d: 5 }, { x: 62, z: 15.5, yaw: 0, w: 6.5, d: 4.5 }, { x: 54, z: 21, yaw: 0, w: 5.4, d: 5.4 }]) {
      walls(b, groundUnder(b), yc - groundUnder(b), GREY.map((v) => v * 0.8));
    }
    walls(nave, yc, 10, GREY);
    gable(nave, yc, 10, 3.2, SLATE, GREY);
    const aisle: Footprint = { x: 55.5, z: 30, yaw: Math.PI / 2, w: 22, d: 5 };
    walls(aisle, yc, 5.5, GREY);
    gable(aisle, yc, 5.5, 1.8, SLATE, GREY);
    const apse: Footprint = { x: 62, z: 15.5, yaw: 0, w: 6.5, d: 4.5 };
    walls(apse, yc, 6.5, GREY);
    gable(apse, yc, 6.5, 2.2, SLATE, GREY);
    const belfry: Footprint = { x: 54, z: 21, yaw: 0, w: 5.4, d: 5.4 };
    walls(belfry, yc, 15.5, GREY);
    const P = frame(belfry, yc);
    const t = 3.05;
    const cs = [[-t, -t], [t, -t], [t, t], [-t, t]];
    for (let i = 0; i < 4; i++) tri(P(cs[i][0], 15.5, cs[i][1]), P(0, 19.5, 0), P(cs[(i + 1) % 4][0], 15.5, cs[(i + 1) % 4][1]), SLATE);
    for (const side of [-1, 1]) {
      for (const lvl of [8.6, 12]) for (const dx of [-0.75, 0.75]) panel(belfry, yc, dx, lvl, 0.9, 2.1, side, DARK);
    }
    footprints.push(wing, nave, aisle, apse, belfry);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const group = new THREE.Group();
  group.add(plainForms(g));
  // broad strokes and lines are always there
  group.add(surfaceStrokes(broadCoat.data(), { segments: 3 }));
  group.add(surfaceStrokes(outlineCoat.data(), { segments: 2 }));
  // each building's fine strokes are drawn only while you are near it, and fade by distance
  const FADE: [number, number] = [28, 52]; // owner: fine strokes should arrive from further off
  const fines = fineSets.map((f) => {
    const mesh = surfaceStrokes(f.w.data(), { segments: 2, fade: FADE });
    mesh.visible = false;
    group.add(mesh);
    return { mesh, x: f.x, z: f.z, reach: f.reach + FADE[1] + 2 };
  });
  const count = (w: StrokeWriter) => w.data().length / 24;
  console.info('village paint: broad', count(broadCoat), 'lines', count(outlineCoat), 'fine in', fines.length, 'sets, total', fineSets.reduce((a, f) => a + count(f.w), 0));
  /** Call every frame with where the walker's head is. */
  const update = (head: THREE.Vector3) => {
    for (const f of fines) f.mesh.visible = Math.hypot(head.x - f.x, head.z - f.z) < f.reach;
  };

  /** True inside a building or wall: you cannot walk through it. */
  const blocked = (x: number, z: number) => {
    for (const fp of footprints) {
      const dx = x - fp.x, dz = z - fp.z;
      const c = Math.cos(fp.yaw), s = Math.sin(fp.yaw);
      if (Math.abs(dx * c + dz * s) < fp.w / 2 + 0.3 && Math.abs(-dx * s + dz * c) < fp.d / 2 + 0.3) return true;
    }
    return false;
  };
  return { group, blocked, update, houses: data.houses.length + extra, trees: treeAt.length };
}
