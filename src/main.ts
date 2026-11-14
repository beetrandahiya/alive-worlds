import * as THREE from 'three';
import { shared } from './paint/strokes';
import { TEST_LIST, testCard } from './ui/testcard';
import { WristReadout } from './ui/wrist';
import { buildCypress } from './worlds/starry/cypress';
import { buildGround } from './worlds/starry/ground';
import { buildVillage } from './worlds/starry/village';
import { buildSky, type StarryMeta } from './worlds/starry/sky';
import { loadTerrain, terrain, WALK_RADIUS } from './worlds/starry/terrain';
import { Rig } from './xr/rig';

declare const __BUILD__: string;

const params = new URLSearchParams(location.search);
const $ = (id: string) => document.getElementById(id)!;
const BASE = import.meta.env.BASE_URL + 'starry/';
const TARGET_RATE = 72;

async function start() {
  $('build').textContent = __BUILD__;
  const canvas = $('view') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // paint colours are written as-is
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFramebufferScaleFactor(Number(params.get('res') ?? 1));
  renderer.xr.setFoveation(Number(params.get('fov') ?? 0.5));
  const gl = renderer.getContext();
  const desktopA2C = gl.getParameter(gl.SAMPLES) > 0 ? 1 : 0;
  shared.uA2C.value = desktopA2C;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6000);
  let walls: (x: number, z: number) => boolean = () => false;
  const rig = new Rig(camera, renderer, terrain, WALK_RADIUS, (x, z) => walls(x, z));
  scene.add(rig.group);

  const meta: StarryMeta = await fetch(BASE + 'starry.json').then((r) => r.json());
  const atlas = await new THREE.TextureLoader().loadAsync(BASE + 'strokes.png');
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.anisotropy = 4;
  shared.uAtlas.value = atlas;

  shared.uRidge.value = await loadTerrain(BASE);
  const sky = await buildSky(BASE, meta);
  const cypress = buildCypress(meta);
  const ground = await buildGround(BASE, meta);
  const village = await buildVillage(BASE);
  walls = village.blocked;
  console.info('village', village.houses, 'houses', village.trees, 'trees');
  scene.add(sky.group, cypress.group, ground.group, village.group);

  // ---- study controls
  const wrist = new WristReadout(__BUILD__);
  const card = testCard();
  $('tests').innerHTML = TEST_LIST.map(([t, d]) => `<li><b>${t}.</b> ${d}</li>`).join('');
  wrist.set(['Y  what to test']);

  for (const i of [0, 1]) {
    const grip = renderer.xr.getControllerGrip(i);
    grip.addEventListener('connected', (e) => {
      if ((e as unknown as { data: XRInputSource }).data.handedness === 'left') grip.add(wrist.mesh, card);
    });
    rig.group.add(grip);
  }

  // ---- the page
  const shot = params.get('shot');
  const resize = () => {
    if (renderer.xr.isPresenting) return;
    const w = shot ? 1280 : innerWidth;
    const h = shot ? Math.round(1280 / meta.aspect) : innerHeight;
    renderer.setSize(w, h, !shot);
    camera.aspect = w / h;
    // Not in VR: frame the view as the painting does.
    const half = Math.tan(THREE.MathUtils.degToRad(meta.hfovDeg / 2));
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half / Math.max(camera.aspect, meta.aspect)));
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();
  rig.look(Number(params.get('yaw') ?? 0), Number(params.get('pitch') ?? -meta.pitchDeg));
  if (params.has('x')) rig.group.position.set(Number(params.get('x')), 0, Number(params.get('z') ?? 0));
  if (params.has('up')) camera.position.y = Number(params.get('up')); // a bird's-eye view, for checking plans off-headset

  const veil = $('veil');
  const note = $('note');
  const enter = $('enter') as HTMLButtonElement;
  const look = $('look') as HTMLButtonElement;
  if (shot) veil.classList.add('gone');
  look.hidden = false;
  look.onclick = () => veil.classList.add('gone');
  const xr = navigator.xr;
  if (xr && (await xr.isSessionSupported('immersive-vr').catch(() => false))) {
    enter.hidden = false;
    note.textContent = 'Left stick to walk, right stick to turn. Frame rate is on your left wrist; Y shows the test list.';
    enter.onclick = async () => {
      const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      await renderer.xr.setSession(session);
      shared.uA2C.value = 1;
      const rates = (session as XRSession & { supportedFrameRates?: Float32Array }).supportedFrameRates;
      if (rates && Array.from(rates).includes(TARGET_RATE)) await session.updateTargetFrameRate?.(TARGET_RATE);
      veil.classList.add('gone');
      session.addEventListener('end', () => {
        shared.uA2C.value = desktopA2C;
        veil.classList.remove('gone');
        resize();
      });
    };
  } else {
    note.textContent = 'Open this page in the Quest browser to step inside. Here you can drag to look and use W A S D to walk.';
  }

  // ---- every frame
  let last = 0;
  let stills = 0;
  const fixedTime = params.get('t');
  renderer.setAnimationLoop((ms) => {
    const dt = Math.min(0.1, last ? (ms - last) / 1000 : 0.016);
    last = ms;
    shared.uTime.value = fixedTime ? Number(fixedTime) : ms / 1000;
    const pressed = rig.update(dt);
    if (pressed.x) wrist.mesh.visible = !wrist.mesh.visible;
    if (pressed.y) card.visible = !card.visible;
    shared.uCentre.value.copy(rig.head);
    const rate = renderer.xr.getSession()?.frameRate ?? TARGET_RATE;
    if (renderer.xr.isPresenting) wrist.tick(dt, rate);
    renderer.render(scene, camera);
    // For still pictures taken off-headset: paint a few frames, then hold.
    if (shot && ++stills >= 3) {
      renderer.setAnimationLoop(null);
      document.body.dataset.ready = '1';
    }
  });
}

start().catch((e) => {
  console.error(e);
  $('note').textContent = 'Something went wrong while preparing the paint: ' + (e?.message ?? e);
});
