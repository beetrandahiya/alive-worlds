import * as THREE from 'three';

/**
 * The land. You stand on a knoll; ahead it falls to the valley floor, and a
 * ring of hills rises beyond. Each hill line in the painting sits at a known
 * angle above eye level from the viewpoint; given a distance, that angle
 * becomes a height. `tools/starry/analyse.py` works those heights out for
 * every compass direction and stores them in `ridge.bin`. The same formulas
 * live there and in the GLSL below: keep all three in step.
 *
 * Axes: you start at the origin facing -Z; +X is to your right; +Y is up.
 */
const FLOOR = -28;
let ridge = new Float32Array(4);
let NA = 1;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Where each range begins to rise, as a share of its distance (see analyse.py).
const RISE_1 = 0.78;
const RISE_2 = 0.6;
const bump = (d: number, D: number, start: number) => smooth(start * D, D, d) * (1 - 0.75 * smooth(D, 1.5 * D, d));

function knoll(x: number, z: number, d: number): number {
  const fwd = -z / Math.max(d, 1e-3);
  const slope = 0.07 + 0.29 * smooth(-0.2, 0.75, fwd);
  // In front, the hill falls as one even tilted plane (see analyse.py).
  const de = d + (Math.max(-z, 0) - d) * smooth(0.35, 0.7, fwd);
  const q = Math.max(de - 4, 0);
  const f = q < 4 ? (q * q) / 8 : q - 2;
  const und = 0.12 * Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27) + 0.05 * Math.sin(x * 1.1) * Math.sin(z * 0.9 + 2);
  return -slope * f + und * smooth(3, 8, d);
}

export function terrain(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const floor = FLOOR + 1.2 * Math.sin(x * 0.013 + 0.5) * Math.sin(z * 0.011 + 1.0);
  const a = knoll(x, z, d);
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (a - floor)) / 3));
  const base = floor * (1 - h) + a * h + 3 * h * (1 - h);
  const u = ((Math.atan2(x, -z) + Math.PI) / (2 * Math.PI)) * NA - 0.5;
  const i0 = Math.floor(u);
  const f = u - i0;
  const p = (((i0 % NA) + NA) % NA) * 4;
  const q = ((i0 + 1 + NA) % NA) * 4;
  const r = (k: number) => ridge[p + k] * (1 - f) + ridge[q + k] * f;
  return base + Math.max(r(0) * bump(d, r(1), RISE_1), r(2) * bump(d, r(3), RISE_2));
}

/** Load the hill heights. Returns the texture the shaders read them from. */
export async function loadTerrain(base: string): Promise<THREE.DataTexture> {
  const buf: ArrayBuffer = await fetch(base + 'ridge.bin').then((r) => r.arrayBuffer());
  ridge = new Float32Array(buf);
  NA = ridge.length / 4;
  const half = new Uint16Array(ridge.length);
  for (let i = 0; i < ridge.length; i++) half[i] = THREE.DataUtils.toHalfFloat(ridge[i]);
  const tex = new THREE.DataTexture(half, NA, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export const TERRAIN_GLSL = /* glsl */ `
uniform sampler2D uRidge;
float hillBump(float d, float D, float start) {
  return smoothstep(start * D, D, d) * (1.0 - 0.75 * smoothstep(D, 1.5 * D, d));
}
float terrain(vec2 p) {
  float d = length(p);
  float fwd = -p.y / max(d, 1e-3);
  float slope = mix(0.07, 0.36, smoothstep(-0.2, 0.75, fwd));
  float de = mix(d, max(-p.y, 0.0), smoothstep(0.35, 0.7, fwd));
  float q = max(de - 4.0, 0.0);
  float f = q < 4.0 ? q * q / 8.0 : q - 2.0;
  float und = 0.12 * sin(p.x * 0.31 + 1.3) * sin(p.y * 0.27) + 0.05 * sin(p.x * 1.1) * sin(p.y * 0.9 + 2.0);
  float a = -slope * f + und * smoothstep(3.0, 8.0, d);
  float fl = -28.0 + 1.2 * sin(p.x * 0.013 + 0.5) * sin(p.y * 0.011 + 1.0);
  float h = clamp(0.5 + 0.5 * (a - fl) / 3.0, 0.0, 1.0);
  float base = mix(fl, a, h) + 3.0 * h * (1.0 - h);
  vec4 r = texture2D(uRidge, vec2(atan(p.x, -p.y) / 6.2831853 + 0.5, 0.5));
  return base + max(r.x * hillBump(d, r.y, 0.78), r.z * hillBump(d, r.w, 0.6));
}`;

/** How far you can walk from the viewpoint in this study. */
export const WALK_RADIUS = 340;
