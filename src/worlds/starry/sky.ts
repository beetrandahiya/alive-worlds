import * as THREE from 'three';
import { DOME_FRAG, DOME_VERT } from '../../paint/shaders';
import { shared, skyStrokes } from '../../paint/strokes';

export interface StarryMeta {
  hfovDeg: number;
  pitchDeg: number;
  aspect: number;
  sky: number;
  land: number;
  valley: { floor: number; na: number; nr: number; rMin: number; rMax: number; strokes: number };
  under: { elMinDeg: number };
  palettes: {
    cypress: number[][]; cypressWeight: number[];
    bush: number[][]; bushWeight: number[];
    hill: number[][]; sky: number[][];
  };
}

/**
 * The sky: an undercoat dome, the flowing sky strokes measured from the
 * painting, and a second coat of small dabs on the stars and moon.
 * All of it sits at infinity and is drawn behind the world.
 */
export async function buildSky(base: string, meta: StarryMeta) {
  const group = new THREE.Group();
  const [underTex, skyData, landData] = await Promise.all([
    new THREE.TextureLoader().loadAsync(base + 'sky_under.jpg'),
    fetch(base + 'sky_strokes.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'land_strokes.bin').then((r) => r.arrayBuffer()),
  ]);
  underTex.colorSpace = THREE.NoColorSpace;
  underTex.generateMipmaps = false;
  underTex.minFilter = THREE.LinearFilter;
  underTex.wrapS = THREE.RepeatWrapping;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.ShaderMaterial({
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      uniforms: {
        uUnder: { value: underTex },
        uElMin: { value: THREE.MathUtils.degToRad(meta.under.elMinDeg) },
        uA2C: shared.uA2C,
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthFunc: THREE.LessEqualDepth,
    }),
  );
  dome.frustumCulled = false;

  const sky = skyStrokes(new Float32Array(skyData), 3);
  const land = skyStrokes(new Float32Array(landData), 2);
  // Painted after the world's solid things, in this order: canvas, sky, hills.
  dome.renderOrder = 10;
  sky.renderOrder = 11;
  land.renderOrder = 12;
  group.add(dome, sky, land);

  return { group };
}
