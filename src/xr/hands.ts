import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VER } from '../version';
import { SURFACE_FRAG } from '../paint/shaders';
import { rng, shared } from '../paint/strokes';
import { defaultPose, pressedPose } from './handPoses';

/**
 * THE WALKER'S HANDS, PAINTED AS HE PAINTED HANDS (research 2026-11-18, see CLAUDE.md).
 *
 * The form is the free WebXR "generic hand" (MIT, (c) 2019 Amazon), posed round the controller
 * with Meta's poses (MIT). Over it: an undercoat in his flesh colour, then his strokes laid on
 * the surface and following it, each taking its colour from one point of his own painted hand:
 * the back from the Sheaf-Binder's hand curled over the sheaf (F693), the palm from the Sheaf-Binder's raised hand (F693),
 * a sleeve from the Sheaf-Binder's smock. Mid-green strokes between the fingers, one pale stroke
 * over the knuckles, and his broken navy outline along the outer edges.
 *
 * PREVIEW: the pose is fixed when the hand is built (no fingers moving yet).
 */
export interface HandLook {
  /** 'few': his count, about 15 broad strokes a hand. 'fine': about 300 smaller ones. */
  strokes: 'few' | 'fine';
  raised: boolean;
  night: boolean;
  sleeve: boolean;
}

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const NAVY = [35 / 255, 38 / 255, 48 / 255];
const SLATE = [85 / 255, 105 / 255, 90 / 255];
const CREAM = [195 / 255, 200 / 255, 150 / 255];
const FINGERS = ['index', 'middle', 'ring', 'pinky'];
const CHAIN = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];

const HAND_VERT = /* glsl */ `
attribute vec3 aT;
attribute vec3 aB;
attribute vec3 aCol;
attribute vec3 aCol2;
attribute float aShape;
uniform vec3 uMoon;
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vCol2;
varying vec2 vLight;
varying float vShape;
varying float vSheen;
varying float vFace;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  mat3 m = mat3(modelMatrix);
  vec3 T = normalize(m * aT), B = normalize(m * aB), N = normalize(m * normal);
  vUv = uv;
  vCol = aCol;
  vCol2 = aCol2;
  vShape = aShape;
  vLight = vec2(dot(uMoon, T), dot(uMoon, B));
  vec3 Vw = normalize(cameraPosition - w.xyz);
  vec3 Nf = N * sign(dot(N, Vw) + 1e-4);
  vSheen = pow(max(dot(Nf, normalize(uMoon + Vw)), 0.0), 30.0);
  vFace = 0.9 + 0.1 * abs(dot(N, uMoon));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const UNDER_VERT = /* glsl */ `
attribute vec3 aCol;
varying vec3 vCol;
void main() {
  vCol = aCol;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;
const UNDER_FRAG = /* glsl */ `
varying vec3 vCol;
void main() { gl_FragColor = vec4(gl_FrontFacing ? vCol : vCol * 0.35, 1.0); }`;

const HULL_VERT = /* glsl */ `
attribute float aThick;
uniform vec3 uMoon;
void main() {
  vec3 n = normalize(mat3(modelMatrix) * normal);
  float shade = 0.65 + 0.7 * max(0.0, -dot(n, uMoon));
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.xyz += n * aThick * shade;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HULL_FRAG = /* glsl */ `
uniform vec3 uInk;
void main() { gl_FragColor = vec4(uInk, 1.0); }`;
function outlineShell(g: THREE.BufferGeometry, look: HandLook) {
  const ink = look.night ? [0.11, 0.13, 0.22] : NAVY;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    vertexShader: HULL_VERT,
    fragmentShader: HULL_FRAG,
    uniforms: { uMoon: shared.uMoon, uInk: { value: new THREE.Color(...ink) } },
    side: THREE.BackSide,
  }));
  m.frustumCulled = false;
  return m;
}

/** A patch of his paint, read point by point. */
async function patch(url: string, flesh: boolean) {
  const im = await new THREE.ImageLoader().loadAsync(url);
  const c = document.createElement('canvas');
  c.width = im.width;
  c.height = im.height;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, im.width, im.height).data;
  const w = im.width, h = im.height;
  const ok = (i: number) => {
    if (!flesh) return true;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // his flesh, not the sky, smock or outline that the crop also caught
    return !(b > g + 6 && b > r + 6) && r + g + b > 150;
  };
  let mean = [0, 0, 0], n = 0;
  for (let i = 0; i < d.length; i += 4) if (ok(i)) { mean[0] += d[i]; mean[1] += d[i + 1]; mean[2] += d[i + 2]; n++; }
  mean = mean.map((v) => v / Math.max(1, n) / 255);
  /** u, v in 0..1 */
  const at = (u: number, v: number) => {
    const fold = (t: number) => 1 - Math.abs(1 - (((t % 2) + 2) % 2));
    const px = Math.floor(fold(u) * (w - 1)), py = Math.floor(fold(v) * (h - 1));
    for (let r = 0; r < Math.max(w, h); r++) {
      for (let k = 0; k < Math.max(1, r * 6); k++) {
        const a = (k / Math.max(1, r * 6)) * Math.PI * 2;
        const qx = Math.round(px + Math.cos(a) * r), qy = Math.round(py + Math.sin(a) * r);
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const i = (qy * w + qx) * 4;
        if (ok(i)) return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
      }
    }
    return mean;
  };
  // his pixels sorted by lightness, so a stroke can ask for his light, mid or shadow paint near a point
  const lum = (i: number) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  const ls: number[] = [];
  for (let i = 0; i < d.length; i += 4) if (ok(i)) ls.push(lum(i));
  ls.sort((p, q) => p - q);
  const q = (f: number) => ls[Math.min(ls.length - 1, Math.floor(f * ls.length))] ?? 128;
  /** tone 0 = his darkest flesh here, 1 = his lightest */
  const pick = (u: number, v: number, tone: number, R = 0.25) => {
    const fold = (t: number) => 1 - Math.abs(1 - (((t % 2) + 2) % 2));
    const cx = fold(u) * (w - 1), cy = fold(v) * (h - 1), rad = Math.max(3, R * Math.max(w, h));
    const want = q(0.05 + 0.9 * tone);
    let best = -1, bd = Infinity;
    for (let k = 0; k < 60; k++) {
      const a = k * 2.399, rr = rad * Math.sqrt((k + 0.5) / 60);
      const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      if (!ok(i)) continue;
      const dd = Math.abs(lum(i) - want);
      if (dd < bd) { bd = dd; best = i; }
    }
    return best < 0 ? at(u, v) : [d[best] / 255, d[best + 1] / 255, d[best + 2] / 255];
  };
  // the mid paint: the average of his middle tones
  let mid = [0, 0, 0], mn = 0;
  const lo = q(0.3), hi = q(0.65);
  for (let i = 0; i < d.length; i += 4) if (ok(i) && lum(i) >= lo && lum(i) <= hi) { mid[0] += d[i]; mid[1] += d[i + 1]; mid[2] += d[i + 2]; mn++; }
  mid = mid.map((v) => v / Math.max(1, mn) / 255);
  return { at, mean, pick, mid };
}

export async function buildHand(base: string, side: 'left' | 'right', look: HandLook, grip = 0.35, trigger = 0.25, seed = 7) {
  const r = rng(seed + (side === 'left' ? 100 : 0));
  const gltf = await new GLTFLoader().loadAsync(base + 'hands/hand_' + side + '.glb' + VER);
  const [back, palm, sleeve] = await Promise.all([
    patch(base + 'hands/paint_back.jpg' + VER, true),
    patch(base + 'hands/paint_palm.jpg' + VER, true),
    patch(base + 'hands/paint_sleeve.jpg' + VER, false),
  ]);
  const root = gltf.scene;
  root.scale.setScalar(1.05);
  let sm: THREE.SkinnedMesh | null = null;
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) sm = o as THREE.SkinnedMesh; });
  const mesh = sm as unknown as THREE.SkinnedMesh;
  const bones: Record<string, THREE.Bone> = {};
  for (const b of mesh.skeleton.bones) bones[b.name] = b;
  root.updateMatrixWorld(true);
  mesh.skeleton.update();

  const pos = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex()!;
  const skinI = mesh.geometry.getAttribute('skinIndex'), skinW = mesh.geometry.getAttribute('skinWeight');
  const nv = pos.count;
  const skinned = () => {
    const out = new Float32Array(nv * 3), v = V();
    for (let i = 0; i < nv; i++) {
      v.fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld);
      out.set([v.x, v.y, v.z], i * 3);
    }
    return out;
  };
  const jointsNow = () => {
    const j: Record<string, V3> = {};
    for (const k in bones) j[k] = bones[k].getWorldPosition(V());
    return j;
  };
  const restP = skinned(), restJ = jointsNow();

  // --- the pose, round the controller (Meta's resting and closed poses, blended)
  const m = new THREE.Matrix4(), pa = V(), pb = V(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), sc = V();
  for (const name in defaultPose) {
    const b = bones[name];
    if (!b) continue;
    const t = name.startsWith('index') ? trigger : name.startsWith('thumb') ? 0 : grip;
    m.fromArray(defaultPose[name]).decompose(pa, qa, sc);
    m.fromArray(pressedPose[name]).decompose(pb, qb, sc);
    if (side === 'left') for (const [p, q] of [[pa, qa], [pb, qb]] as [V3, THREE.Quaternion][]) { p.x *= -1; q.x *= -1; q.w *= -1; }
    b.position.lerpVectors(pa, pb, t);
    b.quaternion.slerpQuaternions(qa, qb, t);
  }
  root.updateMatrixWorld(true);
  mesh.skeleton.update();
  const P = skinned(), J = jointsNow();

  // --- the posed surface: triangles, normals
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setIndex(index.clone());
  geo.computeVertexNormals();
  const N = geo.getAttribute('normal') as THREE.BufferAttribute;
  const rest = new THREE.BufferGeometry();
  rest.setAttribute('position', new THREE.BufferAttribute(restP, 3));
  rest.setIndex(index.clone());
  rest.computeVertexNormals();
  const RN = rest.getAttribute('normal') as THREE.BufferAttribute;
  const ix = index.array;
  const nt = ix.length / 3;

  // the hand's own frame, at rest (flat) and as posed
  const frame = (j: Record<string, V3>) => {
    const w = j['wrist'];
    const along = j['middle-finger-phalanx-proximal'].clone().sub(w).normalize();
    const across = j['index-finger-phalanx-proximal'].clone().sub(j['pinky-finger-phalanx-proximal']).normalize();
    const backN = along.clone().cross(across).normalize();
    across.copy(backN.clone().cross(along)).normalize();
    return { w, along, across, backN };
  };
  const RF = frame(restJ), F = frame(J);
  // the back of the hand faces away from where the fingers curl
  const curlR = restJ['middle-finger-tip'].clone().sub(restJ['middle-finger-phalanx-proximal']);
  const curl = J['middle-finger-tip'].clone().sub(J['middle-finger-phalanx-proximal']);
  if (curl.dot(F.backN) > 0) { F.backN.negate(); F.across.negate(); }
  // at rest the hand is flat: choose the back as the side the thumb does not fold toward
  const thumbR = restJ['thumb-tip'].clone().sub(restJ['thumb-metacarpal']);
  if (thumbR.dot(RF.backN) > 0.002 && curlR.dot(RF.backN) >= 0) { RF.backN.negate(); RF.across.negate(); }
  const handLen = restJ['middle-finger-tip'].distanceTo(RF.w);
  const handWid = restJ['index-finger-phalanx-proximal'].distanceTo(restJ['pinky-finger-phalanx-proximal']);

  const boneOf = (vi: number) => {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = skinW.getComponent(vi, k); if (w > bw) { bw = w; best = skinI.getComponent(vi, k); } }
    return mesh.skeleton.bones[best].name;
  };
  const vBone: string[] = [];
  for (let i = 0; i < nv; i++) vBone.push(boneOf(i));
  /** where a vertex sits on the flat hand: across (0..1, index side = 1), along (0 wrist .. 1 fingertips), facing (+ back, - palm) */
  const placeOf = (i: number) => {
    const p = V(restP[i * 3], restP[i * 3 + 1], restP[i * 3 + 2]).sub(RF.w);
    const n = V().fromBufferAttribute(RN, i);
    return { u: 0.5 + p.dot(RF.across) / (handWid * 1.6), v: p.dot(RF.along) / handLen, facing: n.dot(RF.backN) };
  };

  // --- finding the surface near a point
  const tri = new THREE.Triangle(), cp = V(), best = V();
  const cent: V3[] = [];
  for (let t = 0; t < nt; t++) {
    const a = ix[t * 3], b = ix[t * 3 + 1], c = ix[t * 3 + 2];
    cent.push(V((P[a * 3] + P[b * 3] + P[c * 3]) / 3, (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3));
  }
  const vtx = (i: number) => V(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  /** nearest surface point, its normal and nearest vertex */
  const snap = (q: V3) => {
    let bd = Infinity, bt = 0;
    for (const rad of [0.03, 0.08, 1]) {
      for (let t = 0; t < nt; t++) {
        if (cent[t].distanceToSquared(q) > rad * rad) continue;
        tri.set(vtx(ix[t * 3]), vtx(ix[t * 3 + 1]), vtx(ix[t * 3 + 2]));
        tri.closestPointToPoint(q, cp);
        const d = cp.distanceToSquared(q);
        if (d < bd) { bd = d; bt = t; best.copy(cp); }
      }
      if (bd < Infinity) break;
    }
    const a = ix[bt * 3], b = ix[bt * 3 + 1], c = ix[bt * 3 + 2];
    tri.set(vtx(a), vtx(b), vtx(c));
    const bc = tri.getBarycoord(best, V());
    const n = V().addScaledVector(V().fromBufferAttribute(N, a), bc!.x).addScaledVector(V().fromBufferAttribute(N, b), bc!.y).addScaledVector(V().fromBufferAttribute(N, c), bc!.z).normalize();
    const near = bc!.x > bc!.y && bc!.x > bc!.z ? a : bc!.y > bc!.z ? b : c;
    return { p: best.clone(), n, near };
  };

  // --- strokes: ribbons that lie on the surface
  const sp: number[] = [], sn: number[] = [], su: number[] = [], sT: number[] = [], sB: number[] = [], sC: number[] = [], sC2: number[] = [], sS: number[] = [], si: number[] = [];
  const nightOf = (c: number[]) => {
    if (!look.night) return c;
    const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    return [c[0] * 0.7 + l * 0.12, c[1] * 0.78 + l * 0.18, c[2] * 0.8 + l * 0.42];
  };
  const SEG = 8;
  /** a stroke along a path of points (snapped to the surface), `rise` metres proud of it */
  let made = 0;
  const ribbon = (path: V3[], width: number, colour: number[], streak: number[], rise: number) => {
    // resample the path into SEG+1 even points on the surface
    const L: number[] = [0];
    for (let i = 1; i < path.length; i++) L.push(L[i - 1] + path[i].distanceTo(path[i - 1]));
    const total = L[L.length - 1];
    if (total < 0.004) return;
    const pts: { p: V3; n: V3 }[] = [];
    for (let k = 0; k <= SEG; k++) {
      const s = (k / SEG) * total;
      let i = 1;
      while (i < L.length - 1 && L[i] < s) i++;
      const f = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      const q = path[i - 1].clone().lerp(path[i], f);
      pts.push(snap(q));
    }
    made++;
    const base = sp.length / 3;
    const shape = Math.floor(r.next() * 8);
    const col = nightOf(colour), col2 = nightOf(streak);
    pts.forEach((pt, k) => {
      const t = (k < SEG ? pts[k + 1].p.clone().sub(pt.p) : pt.p.clone().sub(pts[k - 1].p)).normalize();
      const b = pt.n.clone().cross(t).normalize();
      const u = k / SEG;
      // a loaded brush: a touch thinner at both ends
      const w = width * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 1.15)));
      const lift = pt.p.clone().addScaledVector(pt.n, rise * (0.6 + 0.4 * Math.sin(Math.PI * u)));
      for (const s of [-1, 1]) {
        const q = lift.clone().addScaledVector(b, (s * w) / 2);
        sp.push(q.x, q.y, q.z);
        sn.push(pt.n.x, pt.n.y, pt.n.z);
        su.push(u, s < 0 ? 0 : 1);
        sT.push(t.x, t.y, t.z);
        sB.push(b.x, b.y, b.z);
        sC.push(...col);
        sC2.push(...col2);
        sS.push(shape);
      }
      if (k < SEG) {
        const a = base + k * 2;
        si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
  };
  /** walk across the surface from a point along a direction field, both ways from the middle */
  const walk = (start: V3, dirAt: (p: V3, n: V3) => V3, len: number) => {
    const half: V3[][] = [[], []];
    [1, -1].forEach((sg, h) => {
      let p = snap(start);
      for (let k = 0; k < 5; k++) {
        const d = dirAt(p.p, p.n).multiplyScalar(sg);
        d.addScaledVector(p.n, -d.dot(p.n)).normalize();
        const q = p.p.clone().addScaledVector(d, len / 10);
        p = snap(q);
        half[h].push(p.p);
      }
    });
    return [...half[1].reverse(), snap(start).p, ...half[0]];
  };
  const jointOf = (f: string, c: string) => (f === 'thumb' ? J['thumb-' + c] : J[f + '-finger-' + c]);
  /** the direction his strokes run at a point: along a finger, across the back of the fist */
  const dirAt = (bone: string) => (p: V3, n: V3) => {
    const f = [...FINGERS, 'thumb'].find((x) => bone.startsWith(x));
    const onFinger = f && !bone.endsWith('metacarpal') && (f !== 'thumb' || !bone.endsWith('metacarpal'));
    if (onFinger) {
      // along the finger: toward the next joint along it
      const names = f === 'thumb' ? ['phalanx-proximal', 'phalanx-distal', 'tip'] : CHAIN.slice(1);
      let bi = 0, bd = Infinity;
      names.forEach((c, i) => { const d = jointOf(f!, c).distanceTo(p); if (d < bd) { bd = d; bi = i; } });
      const a = jointOf(f!, names[Math.max(0, Math.min(bi, names.length - 2))]), b = jointOf(f!, names[Math.min(names.length - 1, Math.max(1, bi + 1))]);
      return b.clone().sub(a).normalize();
    }
    // the back and palm: across, leaning a little toward the fingers (his Reaper's fist)
    void n;
    return F.across.clone().multiplyScalar(Math.cos(0.35)).addScaledVector(F.along, Math.sin(0.35)).normalize();
  };
  const colourAt = (vi: number, jitter = 0.03) => {
    const pl = placeOf(vi);
    const src = pl.facing < -0.15 ? palm : back;
    // as he lights a hand: the top of the back catches the light, the sides and the underside go to shadow
    const n = V().fromBufferAttribute(N, vi);
    const top = n.dot(F.backN);
    const tone = THREE.MathUtils.clamp(0.5 + 0.5 * top + r.range(-0.25, 0.25), 0, 1);
    const u = pl.u + r.range(-jitter, jitter), v = 1 - pl.v + r.range(-jitter, jitter);
    return [src.pick(u, v, tone), src.pick(u + 0.08, v + 0.05, Math.min(1, tone + 0.25))];
  };

  // THE FILL. Strokes are laid until the skin is covered: finger-wide ones for his count (he gives
  // the side of a hand that a picture shows 6 to 10; a hand seen from every side needs three or
  // four times that), smaller ones for the finer coat. Neighbours keep a little apart, so the
  // strokes do not pile on one another.
  {
    const big = look.strokes === 'few';
    const W: [number, number] = big ? [0.016, 0.021] : [0.0055, 0.0085];
    const Ln: [number, number] = big ? [0.038, 0.058] : [0.016, 0.03];
    const area: number[] = [];
    let total = 0;
    for (let t = 0; t < nt; t++) {
      tri.set(vtx(ix[t * 3]), vtx(ix[t * 3 + 1]), vtx(ix[t * 3 + 2]));
      total += tri.getArea();
      area.push(total);
    }
    const want = Math.round((total * (big ? 1.25 : 1.5)) / (((W[0] + W[1]) / 2) * ((Ln[0] + Ln[1]) / 2) * 0.75));
    const placed: V3[] = [];
    const gap = (W[0] + W[1]) * (big ? 0.42 : 0.32);
    for (let tries = 0; placed.length < want && tries < want * 30; tries++) {
      const x = r.next() * total;
      let lo = 0, hi = nt - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (area[mid] < x) lo = mid + 1; else hi = mid; }
      const a = ix[lo * 3], b = ix[lo * 3 + 1], c = ix[lo * 3 + 2];
      let e = r.next(), g = r.next();
      if (e + g > 1) { e = 1 - e; g = 1 - g; }
      const p = vtx(a).addScaledVector(vtx(b).sub(vtx(a)), e).addScaledVector(vtx(c).sub(vtx(a)), g);
      if (placed.some((q) => q.distanceToSquared(p) < gap * gap)) continue;
      placed.push(p);
      const [col, col2] = colourAt(a, big ? 0.03 : 0.015);
      const d = dirAt(vBone[a]);
      const turn = r.range(-0.18, 0.18);
      ribbon(walk(p, (q, n) => d(q, n).applyAxisAngle(n, turn), r.range(Ln[0], Ln[1])), r.range(W[0], W[1]), col, col2, (big ? 0.0022 : 0.0018) + r.range(0, 0.001));
    }
  }
  // Between the fingers: mid-green strokes, never black
  for (let i = 0; i < 3; i++) {
    const fa = FINGERS[i], fb = FINGERS[i + 1];
    const path = CHAIN.slice(1, 4).map((c) => jointOf(fa, c).clone().lerp(jointOf(fb, c), 0.5).addScaledVector(F.backN, 0.012));
    const pieces = look.strokes === 'few' ? 1 : 2;
    for (let k = 0; k < pieces; k++) {
      const sub = pieces === 1 ? path : k === 0 ? path.slice(0, 2) : path.slice(1);
      ribbon(sub, look.strokes === 'few' ? 0.006 : 0.0045, SLATE.map((v) => v * r.range(0.9, 1.1)), SLATE, 0.0032);
    }
  }
  // One pale stroke along the knuckles
  {
    const path = FINGERS.map((f) => jointOf(f, 'phalanx-proximal').clone().addScaledVector(F.backN, 0.015));
    if (look.strokes === 'few') ribbon(path, 0.008, CREAM, back.mean, 0.0035);
    else for (const f of FINGERS) ribbon(walk(jointOf(f, 'phalanx-proximal').clone().addScaledVector(F.backN, 0.015), () => F.across.clone(), 0.016), 0.005, CREAM, back.mean, 0.0035);
  }
  let hullMesh: THREE.Mesh | null = null;
  const group = new THREE.Group();
  // --- undercoat: the form in his flesh colour (lighter toward the back, his slate in the folds)
  {
    const col = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const pl = placeOf(i);
      const base = pl.facing < -0.15 ? palm.mid : back.mid;
      const n = V().fromBufferAttribute(N, i);
      const k = THREE.MathUtils.smoothstep(n.dot(F.backN), -0.6, 0.7);
      const c = nightOf([0, 1, 2].map((j) => base[j] * (0.62 + 0.3 * k) + SLATE[j] * (0.25 - 0.2 * k)));
      col.set(c, i * 3);
    }
    geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    const under = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: UNDER_VERT, fragmentShader: UNDER_FRAG, side: THREE.DoubleSide }));
    under.frustumCulled = false;
    group.add(under);
  }

  // --- HIS BROKEN NAVY OUTLINE: a thin dark shell just outside the hand, seen only from behind,
  // so it always shows as a line along whatever edge you see, the same to both eyes. Its
  // thickness wanders over the hand (fixed to it), so the line is broken as his is; it is
  // heavier on the side away from the moon (the shader), as his is heaviest in shadow.
  {
    const thick = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const x = restP[i * 3] * 90, y = restP[i * 3 + 1] * 90, z = restP[i * 3 + 2] * 90;
      const wob = 0.5 + 0.3 * Math.sin(x * 1.7 + y * 0.9) * Math.cos(z * 1.3 - y * 0.7) + 0.2 * Math.sin(x * 4.1 - z * 3.3 + y * 2.2);
      thick[i] = Math.max(0, wob - 0.18) * 0.0062;
    }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.BufferAttribute(P, 3));
    hull.setAttribute('normal', N);
    hull.setAttribute('aThick', new THREE.BufferAttribute(thick, 1));
    hull.setIndex(index.clone());
    hullMesh = outlineShell(hull, look);
  }

  // --- a short blue sleeve, as every hand he painted comes out of one
  if (look.sleeve) {
    const arm = F.w.clone().sub(J['middle-finger-phalanx-proximal']).normalize();
    const ac = F.across.clone(), bk = F.backN.clone();
    const ring = 20, rows = 8, length = 0.24;
    const tp: number[] = [], tc: number[] = [], ti: number[] = [];
    const surf = (u: number, s: number) => {
      const a = (u / ring) * Math.PI * 2;
      const grow = 1 + 0.22 * s;
      const c = F.w.clone().addScaledVector(arm, -0.012 + s * length);
      return c.addScaledVector(ac, Math.cos(a) * 0.044 * grow).addScaledVector(bk, Math.sin(a) * 0.034 * grow - 0.004);
    };
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= ring; i++) {
      const q = surf(i, j / rows);
      tp.push(q.x, q.y, q.z);
      tc.push(...nightOf(sleeve.pick(i / ring, j / rows, 0.12, 0.5)));
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < ring; i++) {
      const a = j * (ring + 1) + i;
      ti.push(a, a + ring + 1, a + 1, a + 1, a + ring + 1, a + ring + 2);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.setAttribute('aCol', new THREE.Float32BufferAttribute(tc, 3));
    tg.setIndex(ti);
    const tube = new THREE.Mesh(tg, new THREE.ShaderMaterial({ vertexShader: UNDER_VERT, fragmentShader: UNDER_FRAG, side: THREE.DoubleSide }));
    tube.frustumCulled = false;
    group.add(tube);
    // strokes on the sleeve, along the arm's folds; a dark line round its opening
    const nS = look.strokes === 'few' ? 80 : 420;
    for (let k = 0; k < nS; k++) {
      const u = r.next() * ring, s = r.range(0.08, 0.92);
      const len = look.strokes === 'few' ? r.range(0.05, 0.075) : r.range(0.022, 0.036);
      const turn = r.range(-0.5, 0.5);
      const pts: V3[] = [];
      for (let i = 0; i <= 4; i++) {
        const t = (i / 4 - 0.5) * len;
        pts.push(surf(u + (t * Math.sin(turn) * ring) / (Math.PI * 2 * 0.04), s + (t * Math.cos(turn)) / length));
      }
      const tone = r.next(), c = sleeve.pick(u / ring, s, tone), c2 = sleeve.pick(u / ring + 0.08, s + 0.05, Math.min(1, tone + 0.3));
      // (sleeve strokes are not on the hand's surface: lay them directly)
      sleeveRibbon(pts, look.strokes === 'few' ? 0.024 : 0.011, nightOf(c), nightOf(c2));
    }
    for (let i = 0; i < ring; i += 2) if (r.next() > 0.2) sleeveRibbon([surf(i, 0.0), surf(i + 2.2, 0.0)], 0.007, NAVY, NAVY);
    // his dark line down both sides of a sleeve
    for (const side of [0, ring / 2]) for (let s = 0; s < 0.9; s += 0.16) if (r.next() > 0.15) sleeveRibbon([surf(side + r.range(-0.3, 0.3), s), surf(side + r.range(-0.3, 0.3), s + r.range(0.12, 0.16))], 0.008, NAVY, NAVY);
    function sleeveRibbon(pts: V3[], width: number, col: number[], col2: number[]) {
      made++;
      const base = sp.length / 3;
      const shape = Math.floor(r.next() * 8);
      pts.forEach((p, k) => {
        const t = (k < pts.length - 1 ? pts[k + 1].clone().sub(p) : p.clone().sub(pts[k - 1])).normalize();
        const out = p.clone().sub(F.w.clone().addScaledVector(arm, arm.dot(p.clone().sub(F.w)))).normalize();
        const b = out.clone().cross(t).normalize();
        const q0 = p.clone().addScaledVector(out, 0.0025);
        for (const s of [-1, 1]) {
          const q = q0.clone().addScaledVector(b, (s * width) / 2);
          sp.push(q.x, q.y, q.z);
          sn.push(out.x, out.y, out.z);
          su.push(k / (pts.length - 1), s < 0 ? 0 : 1);
          sT.push(t.x, t.y, t.z);
          sB.push(b.x, b.y, b.z);
          sC.push(...col);
          sC2.push(...col2);
          sS.push(shape);
        }
        if (k < pts.length - 1) { const a = base + k * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
    }
  }

  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sg.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
  sg.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
  sg.setAttribute('aT', new THREE.Float32BufferAttribute(sT, 3));
  sg.setAttribute('aB', new THREE.Float32BufferAttribute(sB, 3));
  sg.setAttribute('aCol', new THREE.Float32BufferAttribute(sC, 3));
  sg.setAttribute('aCol2', new THREE.Float32BufferAttribute(sC2, 3));
  sg.setAttribute('aShape', new THREE.Float32BufferAttribute(sS, 1));
  sg.setIndex(si);
  const mat = new THREE.ShaderMaterial({
    vertexShader: HAND_VERT,
    fragmentShader: SURFACE_FRAG,
    uniforms: {
      uAtlas: shared.uAtlas,
      uA2C: shared.uA2C,
      uRelief: { value: look.raised ? 0.6 : 0.12 },
      uMoon: shared.uMoon,
      uMoonTint: shared.uMoonTint,
    },
    side: THREE.DoubleSide,
    alphaToCoverage: true,
  });
  if (hullMesh) group.add(hullMesh);
  const strokes = new THREE.Mesh(sg, mat);
  strokes.frustumCulled = false;
  group.add(strokes);
  console.info('hand', side, look.strokes, 'strokes', made);
  return group;
}

/**
 * For still pictures off-headset: where a hand holding a controller sits in front of the eyes
 * (camera space). The grip's -Z runs up the controller's handle toward the thumb, +X is the back
 * of the right hand (WebXR grip space).
 */
export function shotGrip(side: 'left' | 'right') {
  const rod = new THREE.Vector3(0.05, 0.72, -0.69).normalize();
  const Z = rod.clone().negate();
  const X = new THREE.Vector3(0.92, 0.25, 0.3);
  X.addScaledVector(Z, -X.dot(Z)).normalize();
  const Y = Z.clone().cross(X);
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(0.17, -0.4, -0.36);
  if (side === 'left') {
    const flip = new THREE.Matrix4().makeScale(-1, 1, 1);
    // mirror the whole frame across the face, then turn its X back so the frame stays right-handed
    m.premultiply(flip).multiply(flip);
  }
  return m;
}
