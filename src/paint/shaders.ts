/**
 * The paint. Everything visible in a world is drawn with one of three shaders:
 *
 *  - UNDER: a plain painted undercoat on solid forms (and the sky dome).
 *  - SKY_STROKE: strokes on the sky dome that travel along the measured flow.
 *  - SURFACE_STROKE: strokes laid on solid forms in the world.
 *
 * Colour is kept in display (sRGB) values end to end so it matches the scan.
 */

/** Shared: stroke coverage and the atlas of stroke shapes. */
const COMMON = /* glsl */ `
uniform float uA2C;     // 1 when multisampling can soften stroke edges

// Turn the soft coverage stored in the atlas into a crisp, antialiased edge.
float strokeCover(float a) {
  float c = clamp((a - 0.5) / max(fwidth(a), 1e-4) + 0.5, 0.0, 1.0);
  if (c < mix(0.5, 0.004, uA2C)) discard;
  return c;
}

vec2 atlasUv(vec2 uv, float variant) {
  float col = mod(variant, 2.0);
  float row = floor(variant * 0.5);
  return (vec2(col, row) + uv) / vec2(2.0, 4.0);
}
`;

export const UNDER_VERT = /* glsl */ `
attribute vec3 color;
attribute float aSway;
uniform float uTime;
uniform vec3 uWind;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 w = modelMatrix * vec4(position, 1.0);
  float ph = uTime * 0.45 - w.y * 0.08;
  w.xyz += uWind * aSway * (sin(ph) + 0.3 * sin(ph * 2.3 + 1.0));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const UNDER_FRAG = /* glsl */ `
${COMMON}
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
}`;

export const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = clip.xyww;
}`;

export const DOME_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uUnder;
uniform float uElMin;
uniform float uCanvas;   // 1 = bare canvas flecks show between strokes
varying vec3 vDir;
float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float fleck(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(az / 6.2831853 + 0.5, clamp((el - uElMin) / (1.5707963 - uElMin), 0.002, 0.998));
  vec3 c = texture2D(uUnder, uv).rgb;
  // Bare primed canvas (colour measured at the unpainted edge of the scan)
  // showing in flecks, as it does between strokes on the real painting. The
  // real weave is too fine to draw at this distance, so only the flecks are.
  float f = fleck(d * 190.0) * 0.65 + fleck(d * 410.0) * 0.35;
  float w = fwidth(f) + 1e-4;
  float bare = smoothstep(0.6 - w, 0.6 + w, f) * uCanvas;
  c = mix(c, vec3(0.69, 0.64, 0.51) * (0.92 + 0.16 * fleck(d * 900.0)), bare);
  gl_FragColor = vec4(c, 1.0);
}`;

/**
 * Sky strokes. Each stroke lies on, and travels along, a circle on the dome
 * that was fitted to the flow measured in the painting. It is painted on at
 * one end of its path, drifts, and is lifted off at the other end.
 */
export const SKY_VERT = /* glsl */ `
attribute vec2 aQuad;   // x along the stroke 0..1, y across -1..1
attribute vec4 iA;      // start direction, body angle
attribute vec4 iB;      // circle axis, travel angle
attribute vec4 iC;      // colour, width (radians)
attribute vec4 iD;      // streak colour, seed
attribute vec4 iE;      // glow, pulse phase, shape, speed
uniform float uTime;
uniform float uFlow;
uniform vec3 uCanvasLight;
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vCol2;
varying vec2 vLight;
varying float vShape;

vec3 turn(vec3 p, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c);
}

void main() {
  float moving = step(1e-4, iB.w);
  float period = 30.0 + 16.0 * fract(iD.w * 7.31);
  float life = fract(uTime * uFlow / period + iD.w);
  float env = mix(1.0, smoothstep(0.0, 0.16, life) * (1.0 - smoothstep(0.84, 1.0, life)), moving);
  float a = (life - 0.5) * iB.w * moving + (aQuad.x - 0.5) * iA.w * mix(0.5, 1.0, env);
  vec3 p = turn(iA.xyz, iB.xyz, a);
  vec3 along = normalize(cross(iB.xyz, p));
  vec3 side = cross(p, along);
  p = normalize(p + side * aQuad.y * iC.w * 0.68 * env);

  float pulse = sin(uTime * 0.7 + iE.y * 2.4) * 0.5 + 0.5;
  vCol = iC.rgb * (1.0 + iE.x * (0.16 * pulse - 0.05));
  vCol2 = iD.rgb;
  vShape = iE.z;
  vUv = vec2(aQuad.x, aQuad.y * 0.5 + 0.5);
  vLight = vec2(dot(uCanvasLight, along), dot(uCanvasLight, side));
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * p, 1.0);
  gl_Position = clip.xyww;
}`;

export const SKY_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uAtlas;
uniform float uRelief;
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vCol2;
varying vec2 vLight;
varying float vShape;
void main() {
  vec4 t = texture2D(uAtlas, atlasUv(vUv, vShape));
  float cov = strokeCover(t.a);
  vec3 c = mix(vCol, vCol2, smoothstep(0.56, 0.8, t.b) * 0.55);
  c *= 1.0 + uRelief * dot(t.rg * 2.0 - 1.0, vLight);
  gl_FragColor = vec4(c, cov);
}`;

/**
 * Strokes laid on solid things. A stroke starts on the surface and runs along
 * it; its far end can lift away (cypress flames, grass). Fine strokes fade in
 * as you come close, so every view is painted at the scale you stand at.
 */
export const SURFACE_VERT = /* glsl */ `
attribute vec2 aQuad;
attribute vec4 iP;   // root position, length
attribute vec4 iT;   // direction along the stroke, width
attribute vec4 iN;   // surface normal, lift of the far end
attribute vec4 iC;   // colour, seed
attribute vec4 iC2;  // streak colour, shape
attribute vec4 iW;   // whole-form sway (m), tip sway, sideways bend, 1 = hug the ground
uniform float uTime;
uniform vec3 uWind;
uniform vec2 uFade;      // fine strokes: fully there within x, gone by y (metres)
uniform vec2 uNear;      // broad strokes: absent within x, fully there by y
uniform float uTile;     // > 0: strokes repeat on a square tile that follows you
uniform vec3 uCentre;    // where you are
uniform vec3 uMoon;
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vCol2;
varying vec2 vLight;
varying float vShape;
varying float vSheen;
varying float vFace;

TERRAIN

void main() {
  vec3 root = iP.xyz;
  float grow = 1.0;
  if (uTile > 0.0) {
    root.xz = mod(root.xz - uCentre.xz + uTile * 0.5, uTile) + uCentre.xz - uTile * 0.5;
    float d = max(abs(root.x - uCentre.x), abs(root.z - uCentre.z));
    grow *= 1.0 - smoothstep(uTile * 0.36, uTile * 0.48, d);
    root.y += terrain(root.xz);
  }
  float dist = distance(root, cameraPosition);
  grow *= (1.0 - smoothstep(uFade.x, uFade.y, dist)) * smoothstep(uNear.x, uNear.y, dist);

  vec3 T = iT.xyz, N = iN.xyz;
  vec3 B = normalize(cross(N, T));
  float len = iP.w * mix(0.35, 1.0, grow);
  float wid = iT.w * grow;
  float u = aQuad.x;
  vec3 c = root + T * (u * len) + N * (iN.w * u * u * len) + B * (iW.z * sin(u * 3.14159) * len);

  float ph = uTime * 0.45 - root.y * 0.08 + dot(root.xz, vec2(0.021, 0.017)) * step(0.5, uTile);
  float gust = sin(ph) + 0.3 * sin(ph * 2.3 + 1.0);
  float flutter = sin(uTime * 1.3 + iC.w * 40.0);
  c += uWind * (iW.x * gust + iW.y * u * u * (gust + 0.5 * flutter));

  vec3 pos = c + B * (aQuad.y * wid * 0.68);
  if (iW.w > 0.5) pos.y = terrain(pos.xz) + iP.y + iN.w * u * u * len;
  vUv = vec2(u, aQuad.y * 0.5 + 0.5);
  vCol = iC.rgb;
  vCol2 = iC2.rgb;
  vShape = iC2.w;
  vLight = vec2(dot(uMoon, T), dot(uMoon, B));
  vec3 V = normalize(cameraPosition - pos);
  vec3 Nf = N * sign(dot(N, V) + 1e-4);
  vSheen = pow(max(dot(Nf, normalize(uMoon + V)), 0.0), 30.0);
  vFace = 0.9 + 0.1 * abs(dot(N, uMoon));
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;

export const SURFACE_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uAtlas;
uniform float uRelief;
uniform vec3 uMoonTint;
varying vec2 vUv;
varying vec3 vCol;
varying vec3 vCol2;
varying vec2 vLight;
varying float vShape;
varying float vSheen;
varying float vFace;
void main() {
  vec4 t = texture2D(uAtlas, atlasUv(vUv, vShape));
  float cov = strokeCover(t.a);
  vec3 c = mix(vCol, vCol2, smoothstep(0.56, 0.8, t.b) * 0.6);
  float relief = dot(t.rg * 2.0 - 1.0, vLight);
  c *= vFace * (1.0 + uRelief * relief);
  c += uMoonTint * vSheen * (0.3 + 0.7 * t.b) * 0.12;
  gl_FragColor = vec4(c, cov);
}`;
