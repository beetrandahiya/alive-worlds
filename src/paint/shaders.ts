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

/** The land's undercoat: its colour looked up from the map of the ground. */
export const GROUND_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const GROUND_FRAG = /* glsl */ `
uniform sampler2D uGround;
uniform vec2 uGroundRange;
varying vec3 vWorld;
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float blotch(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float d = max(length(vWorld.xz), uGroundRange.x);
  vec2 uv = vec2(atan(vWorld.x, -vWorld.z) / 6.2831853 + 0.5, log(d / uGroundRange.x) / uGroundRange.y);
  vec3 c = texture2D(uGround, uv).rgb;
  // Broken colour: the underpainting is laid in patches of lighter and darker
  // tone, sized for how far away you are, never a flat wash.
  float size = 0.035 * distance(vWorld, cameraPosition);
  float lod = log2(max(size, 0.05));
  float s0 = exp2(floor(lod)), k = fract(lod);
  float tone = mix(blotch(vWorld.xz / s0), blotch(vWorld.xz / (s0 * 2.0) + 17.0), k);
  tone = tone * 0.6 + 0.4 * mix(blotch(vWorld.xz / (s0 * 4.0) + 5.0), blotch(vWorld.xz / (s0 * 8.0) + 9.0), k);
  gl_FragColor = vec4(c * (0.72 + 0.56 * tone), 1.0);
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
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(az / 6.2831853 + 0.5, clamp((el - uElMin) / (1.5707963 - uElMin), 0.002, 0.998));
  vec3 c = texture2D(uUnder, uv).rgb;
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
uniform sampler2D uGround;   // the ground's own colour, seen from above
uniform vec2 uGroundRange;  // nearest ring (m), log of farthest / nearest
uniform float uTint;        // how much strokes take the colour of the ground they stand on
uniform float uEdgeFade;    // 1: strokes seen edge-on thin away instead of ghosting
uniform sampler2D uShape;   // the lie of the land: slope east and south
uniform float uOrient;      // 1: strokes take their direction from the lie of the land
uniform float uContrast;    // how strongly strokes differ in lightness from their neighbours
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
  float stand = 0.0;
  if (uOrient > 0.5) {
    // On slopes, strokes hatch diagonally downhill, as his hill strokes do.
    // On flat ground they stand up as dabs, as his bushes and groves do,
    // because a stroke lying on flat ground is seen edge-on from eye height.
    vec2 q = vec2(atan(root.x, -root.z) / 6.2831853 + 0.5, log(max(length(root.xz), uGroundRange.x) / uGroundRange.x) / uGroundRange.y);
    vec2 slope = (texture2D(uShape, q).rg - 0.5) * 3.2;
    vec3 N0 = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 contour = normalize(cross(N0, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
    float a = 0.45 + (iC.w - 0.5) * 0.6;
    vec3 lie = normalize(contour * cos(a) + cross(N0, contour) * sin(a));
    float yaw = iC.w * 43.0;
    vec3 up = normalize(vec3(cos(yaw) * 0.55, 1.0, sin(yaw) * 0.55));
    stand = (1.0 - smoothstep(0.14, 0.32, length(slope))) * min(1.0, 5.0 / iP.w);
    T = normalize(mix(lie, up, stand));
    N = normalize(mix(N0, cross(up, vec3(-sin(yaw), 0.0, cos(yaw))), stand));
    N = normalize(N - T * dot(N, T));
  }
  vec3 B = normalize(cross(N, T));
  if (uEdgeFade > 0.5) {
    vec3 at = vec3(root.x, iW.w > 0.5 ? terrain(root.xz) : root.y, root.z);
    vec3 toEye = cameraPosition - at;
    // A flat stroke seen exactly edge-on cannot be drawn cleanly; let it go.
    grow *= smoothstep(0.03, 0.14, abs(dot(N, normalize(toEye))));
    // Strokes sized for a distant view give way as you come near; the fine
    // strokes around you take over (the view is repainted at your scale).
    grow *= smoothstep(2.5 * iP.w, 6.0 * iP.w, length(toEye));
  }
  float len = iP.w * mix(0.35, 1.0, grow);
  float wid = iT.w * grow;
  if (uOrient > 0.5) {
    // A stroke lying on a slope you see at a shallow angle looks squashed.
    // Widen it so that, from where you stand, it has the size it should:
    // the land is painted for your view, as the sky is.
    vec3 toYou = normalize(uCentre - root);
    float lying = 1.0 - stand;
    wid *= mix(1.0, 1.0 / max(sqrt(1.0 - pow(dot(B, toYou), 2.0)), 0.16), lying);
    len *= mix(1.0, 1.0 / max(sqrt(1.0 - pow(dot(T, toYou), 2.0)), 0.4), lying);
  }
  float u = aQuad.x;
  vec3 c = root + T * (u * len) + N * (iN.w * u * u * len) + B * (iW.z * sin(u * 3.14159) * len);

  float ph = uTime * 0.45 - root.y * 0.08 + dot(root.xz, vec2(0.021, 0.017)) * step(0.5, uTile);
  float gust = sin(ph) + 0.3 * sin(ph * 2.3 + 1.0);
  float flutter = sin(uTime * 1.3 + iC.w * 40.0);
  c += uWind * (iW.x * gust + iW.y * u * u * (gust + 0.5 * flutter));

  vec3 pos = c + B * (aQuad.y * wid * 0.68);
  if (iW.w > 0.5) pos.y = mix(terrain(pos.xz) + iP.y + iN.w * u * u * len, pos.y, stand);
  vUv = vec2(u, aQuad.y * 0.5 + 0.5);
  vCol = iC.rgb;
  vCol2 = iC2.rgb;
  if (uTint > 0.0) {
    vec2 g = vec2(atan(root.x, -root.z) / 6.2831853 + 0.5, log(max(length(root.xz), uGroundRange.x) / uGroundRange.x) / uGroundRange.y);
    vec3 earth = texture2D(uGround, g).rgb;
    // Each stroke is the ground's colour, lighter or darker than its
    // neighbours, with a little of its own hue.
    float own = dot(iC.rgb, vec3(0.333)) - 0.33;
    vCol = mix(iC.rgb * 0.8, earth * (1.0 + own * uContrast), uTint);
    vCol2 = mix(iC2.rgb, earth * 0.82, uTint);
  }
  vShape = iC2.w;
  vLight = vec2(dot(uMoon, T), dot(uMoon, B));
  vec3 V = normalize(cameraPosition - pos);
  vec3 Nf = N * sign(dot(N, V) + 1e-4);
  vSheen = pow(max(dot(Nf, normalize(uMoon + V)), 0.0), 30.0);
  vFace = 0.9 + 0.1 * abs(dot(N, uMoon));
  vec4 clip = projectionMatrix * viewMatrix * vec4(pos, 1.0);
  if (uEdgeFade > 0.5) {
    // Coats laid on the land are judged for depth as if a little nearer, so
    // the faceted solid ground beneath can never swallow them.
    vec3 nearer = pos + normalize(cameraPosition - pos) * (0.5 + 0.015 * distance(pos, cameraPosition));
    vec4 c2 = projectionMatrix * viewMatrix * vec4(nearer, 1.0);
    clip.z = c2.z / c2.w * clip.w;
  }
  gl_Position = clip;
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
