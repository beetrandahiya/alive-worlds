import * as THREE from 'three';
import {
  PLAIN_FRAG,
  PLAIN_VERT,
  CANVAS_VERT,
  CANVAS_FRAG,
  GROUND_FRAG,
  GROUND_VERT,
  SKY_FRAG,
  SKY_VERT,
  SURFACE_FRAG,
  SURFACE_VERT,
  UNDER_FRAG,
  UNDER_VERT,
} from './shaders';

/** Uniforms every painted thing shares. One object, so one place to animate. */
export const shared = {
  uTime: { value: 0 },
  uA2C: { value: 1 },
  uFlow: { value: 0.7 }, // owner, in headset: 70% of the first study's speed
  uRelief: { value: 0.5 },
  uWind: { value: new THREE.Vector3(0.8, 0, 0.6).normalize() },
  uCentre: { value: new THREE.Vector3() },
  // The moon as the painting places it: upper right of the view.
  uMoon: { value: new THREE.Vector3(0.36, 0.52, -0.78).normalize() },
  uMoonTint: { value: new THREE.Color(0.95, 0.93, 0.62) },
  // Light raking across the sky's "canvas", from the upper left as in a studio.
  uCanvasLight: { value: new THREE.Vector3(-0.55, 0.7, 0.35).normalize() },
  uAtlas: { value: null as THREE.Texture | null },
  uRidge: { value: null as THREE.Texture | null },
  uGround: { value: null as THREE.Texture | null },
  uGroundRange: { value: new THREE.Vector2(1, 1) },
  // The open ground painted in its own space, seen from above (tools/starry/ground_map.py):
  // the paint, the way its strokes run, and where raised ground strokes may not lie.
  uField: { value: null as THREE.Texture | null },
  uLie: { value: null as THREE.Texture | null },
  uMask: { value: null as THREE.Texture | null },
  uRegion: { value: null as THREE.Texture | null },   // which ground: village plot, stubble, knoll grass
  uPatches: { value: null as THREE.Texture | null },  // his four ground paints, one above the other
  uFieldBox: { value: new THREE.Vector3(-380, -420, 760) },
};

/** A strip of quads; the shaders bend it into a stroke. */
export function ribbon(segments: number): THREE.InstancedBufferGeometry {
  const quad: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    quad.push(i / segments, -1, i / segments, 1);
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('aQuad', new THREE.Float32BufferAttribute(quad, 2));
  // three wants a position attribute to exist; the shaders ignore it.
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(((segments + 1) * 2) * 3), 3));
  g.setIndex(index);
  return g;
}

function interleave(g: THREE.InstancedBufferGeometry, data: Float32Array, names: string[]) {
  const stride = names.length * 4;
  const buf = new THREE.InstancedInterleavedBuffer(data, stride);
  names.forEach((n, i) => g.setAttribute(n, new THREE.InterleavedBufferAttribute(buf, 4, i * 4)));
  g.instanceCount = data.length / stride;
}

const paintMaterial = (vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
  });

/** Strokes on the sky dome. `data` holds 20 floats per stroke (see tools/starry/analyse.py). */
export function skyStrokes(data: Float32Array, segments: number): THREE.Mesh {
  const g = ribbon(segments);
  interleave(g, data, ['iA', 'iB', 'iC', 'iD', 'iE']);
  const m = paintMaterial(SKY_VERT, SKY_FRAG, {
    uTime: shared.uTime,
    uFlow: shared.uFlow,
    uA2C: shared.uA2C,
    uRelief: shared.uRelief,
    uCanvasLight: shared.uCanvasLight,
    uAtlas: shared.uAtlas,
  });
  m.depthWrite = false;
  m.depthFunc = THREE.LessEqualDepth;
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

export const SURFACE_STRIDE = 24;

export interface SurfaceOptions {
  segments: number;
  /** Fine strokes: fully present within `near` metres, gone by `far`. */
  fade?: [number, number];
  /** Broad strokes: absent within `a` metres, fully present by `b`. */
  near?: [number, number];
  /** Repeat on a square tile of this size that follows the viewer. */
  tile?: number;
  /** GLSL source of `float terrain(vec2 xz)`; needed when tiling. */
  terrain?: string;
  /** 0..1: how much strokes take the colour of the ground they stand on. */
  tint?: number;
  /** Ground strokes that run the way the painted ground map runs. 1: coloured from the map; 2: each from one point of his own paint for that ground. */
  field?: number;
  /**
   * Paint these over everything already drawn, in their own order (broad
   * coats first; a higher number is a later coat), instead of sorting by depth. For coats that lie on top of
   * one another on far ground, where depth cannot tell them apart.
   */
  overlay?: number;
}

/** Strokes laid on solid forms. `data` holds 24 floats per stroke (see StrokeWriter). */
export function surfaceStrokes(data: Float32Array, o: SurfaceOptions): THREE.Mesh {
  const g = ribbon(o.segments);
  interleave(g, data, ['iP', 'iT', 'iN', 'iC', 'iC2', 'iW']);
  const m = paintMaterial(
    SURFACE_VERT.replace('TERRAIN', o.terrain ?? 'float terrain(vec2 p) { return 0.0; }'),
    SURFACE_FRAG,
    {
      uTime: shared.uTime,
      uA2C: shared.uA2C,
      uRelief: shared.uRelief,
      uWind: shared.uWind,
      uCentre: shared.uCentre,
      uMoon: shared.uMoon,
      uMoonTint: shared.uMoonTint,
      uAtlas: shared.uAtlas,
      uFade: { value: new THREE.Vector2(...(o.fade ?? [1e6, 2e6])) },
      uTile: { value: o.tile ?? 0 },
      uRidge: shared.uRidge,
      uGround: shared.uGround,
      uGroundRange: shared.uGroundRange,
      uTint: { value: o.tint ?? 0 },
      uField: shared.uField,
      uLie: shared.uLie,
      uMask: shared.uMask,
      uRegion: shared.uRegion,
      uPatches: shared.uPatches,
      uFieldBox: shared.uFieldBox,
      uFieldOn: { value: o.field ?? 0 },
      uEdgeFade: { value: o.overlay !== undefined ? 1 : 0 },
      uNear: { value: new THREE.Vector2(...(o.near ?? [-2, -1])) },
    },
  );
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  if (o.overlay !== undefined) {
    m.depthWrite = false;
    mesh.renderOrder = 19 + o.overlay;
  }
  return mesh;
}

/** Plain undercoat for a solid form. Geometry needs `color` and `aSway`. */
export function undercoat(g: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    vertexShader: UNDER_VERT,
    fragmentShader: UNDER_FRAG,
    uniforms: { uTime: shared.uTime, uWind: shared.uWind, uA2C: shared.uA2C },
    side: THREE.DoubleSide,
    // Sit a hair behind the strokes laid on it, at any distance.
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 12,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

/** Plain solid forms (position, normal, color), before any paint. */
export function plainForms(g: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({ vertexShader: PLAIN_VERT, fragmentShader: PLAIN_FRAG, uniforms: { uMoon: shared.uMoon }, side: THREE.DoubleSide }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

/** Solid forms skinned with the canvas (see CANVAS_FRAG). Parts with aFoldB.x = 0 stay plain. */
export function canvasForms(g: THREE.BufferGeometry, canvas: THREE.Texture, cam: { F: number; pitch: number; W: number; H: number }, rect: number[]): THREE.Mesh {
  const mesh = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({
      vertexShader: CANVAS_VERT,
      fragmentShader: CANVAS_FRAG,
      uniforms: {
        uMoon: shared.uMoon,
        uCanvas: { value: canvas },
        uCentre: shared.uCentre,
        uTreeSoft: { value: new URLSearchParams(location.search).get('trees') === 'his' ? 2.5 : 0 },
        uCam: { value: new THREE.Vector4(cam.F, Math.cos(cam.pitch), Math.sin(cam.pitch), 1.6) },
        uRect: { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) },
        uSize: { value: new THREE.Vector2(cam.W, cam.H) },
      },
      side: THREE.DoubleSide,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

/** The land's undercoat, coloured from the map of the ground. */
export function groundUndercoat(g: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: { uGround: shared.uGround, uGroundRange: shared.uGroundRange, uCentre: shared.uCentre, uField: shared.uField, uFieldBox: shared.uFieldBox },
    side: THREE.DoubleSide,
    // No depth offset here: on far mountains it would push the ground onto the
    // sky's depth and let sky strokes speckle through. Coats laid on the land
    // are instead judged slightly nearer (see SURFACE_VERT).
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

/** Collects surface strokes into the packed layout the shader reads. */
export class StrokeWriter {
  private a: number[] = [];
  add(s: {
    p: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3;
    length: number; width: number; lift: number; bend: number;
    colour: number[]; streak: number[]; seed: number; shape: number;
    sway: number; tipSway: number; hug?: boolean;
  }) {
    this.a.push(
      s.p.x, s.p.y, s.p.z, s.length,
      s.t.x, s.t.y, s.t.z, s.width,
      s.n.x, s.n.y, s.n.z, s.lift,
      s.colour[0], s.colour[1], s.colour[2], s.seed,
      s.streak[0], s.streak[1], s.streak[2], s.shape,
      s.sway, s.tipSway, s.bend, s.hug ? 1 : 0,
    );
  }
  data() {
    return new Float32Array(this.a);
  }
}

/** Small seeded random source so the world is the same every visit. */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a: number, b: number) => a + (b - a) * next(),
    /** Pick from a palette by its weights. */
    pick: (palette: number[][], weights?: number[]) => {
      if (!weights) return palette[Math.floor(next() * palette.length)];
      let r = next() * weights.reduce((x, y) => x + y, 0);
      for (let i = 0; i < palette.length; i++) {
        r -= weights[i];
        if (r <= 0) return palette[i];
      }
      return palette[palette.length - 1];
    },
  };
}
