import * as THREE from 'three';
import {
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
  uCanvas: { value: 0 },
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
      uNear: { value: new THREE.Vector2(...(o.near ?? [-2, -1])) },
    },
  );
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

/** Plain undercoat for a solid form. Geometry needs `color` and `aSway`. */
export function undercoat(g: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    vertexShader: UNDER_VERT,
    fragmentShader: UNDER_FRAG,
    uniforms: { uTime: shared.uTime, uWind: shared.uWind, uA2C: shared.uA2C },
    side: THREE.DoubleSide,
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
