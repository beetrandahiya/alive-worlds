/**
 * The viewpoint knoll. You stand on a small flat top; ahead the ground falls
 * away steeply toward the valley, which is why the village sits low in the
 * painting. The same function exists in GLSL for strokes that follow the ground.
 *
 * Axes: you start at the origin facing -Z; +X is to your right; +Y is up.
 */
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function terrain(x: number, z: number): number {
  const d = Math.hypot(x, z);
  const fwd = -z / Math.max(d, 1e-3);
  const slope = 0.07 + (0.36 - 0.07) * smooth(-0.2, 0.75, fwd);
  const q = Math.max(d - 4, 0);
  const f = q < 4 ? (q * q) / 8 : q - 2;
  const und = 0.12 * Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27) + 0.05 * Math.sin(x * 1.1) * Math.sin(z * 0.9 + 2);
  return -slope * f + und * smooth(3, 8, d);
}

export const TERRAIN_GLSL = /* glsl */ `
float terrain(vec2 p) {
  float d = length(p);
  float fwd = -p.y / max(d, 1e-3);
  float slope = mix(0.07, 0.36, smoothstep(-0.2, 0.75, fwd));
  float q = max(d - 4.0, 0.0);
  float f = q < 4.0 ? q * q / 8.0 : q - 2.0;
  float und = 0.12 * sin(p.x * 0.31 + 1.3) * sin(p.y * 0.27) + 0.05 * sin(p.x * 1.1) * sin(p.y * 0.9 + 2.0);
  return -slope * f + und * smoothstep(3.0, 8.0, d);
}`;

/** How far you can walk from the viewpoint in this study. */
export const WALK_RADIUS = 55;
