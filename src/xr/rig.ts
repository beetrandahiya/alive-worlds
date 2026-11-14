import * as THREE from 'three';

export interface Buttons {
  /** Right controller A and B, left controller X and Y: true on the frame they go down. */
  a: boolean; b: boolean; x: boolean; y: boolean;
}

const WALK = 1.4;    // m/s up to three-quarter push
const STRIDE = 3.0;  // m/s at full push
const TURN = THREE.MathUtils.degToRad(80); // per second, smooth turn

/**
 * The viewer. The rig is the patch of real floor you stand on; your head moves
 * inside it when you physically walk. The thumbsticks move and turn the rig.
 */
export class Rig {
  readonly group = new THREE.Group();
  readonly head = new THREE.Vector3();
  private was = new THREE.Vector3();
  private prev: Record<string, boolean> = {};
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private fwd = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private renderer: THREE.WebGLRenderer,
    private heightAt: (x: number, z: number) => number,
    private walkRadius: number,
    /** True where something solid stands (a wall); you cannot walk into it. */
    private blocked: (x: number, z: number) => boolean = () => false,
  ) {
    this.group.add(camera);
    camera.position.set(0, 1.6, 0);
    this.desktopControls(renderer.domElement);
  }

  /** Look in a direction when not in VR (degrees). */
  look(yawDeg: number, pitchDeg: number) {
    this.yaw = THREE.MathUtils.degToRad(yawDeg);
    this.pitch = THREE.MathUtils.degToRad(pitchDeg);
  }

  private desktopControls(el: HTMLElement) {
    let drag = false;
    el.addEventListener('pointerdown', (e) => { drag = true; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => (drag = false));
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.yaw += e.movementX * 0.003;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.003, -1.4, 1.4);
    });
    addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  update(dt: number): Buttons {
    const out: Buttons = { a: false, b: false, x: false, y: false };
    let moveX = 0, moveZ = 0, turn = 0;
    const session = this.renderer.xr.getSession();
    const edge = (id: string, down: boolean) => {
      const hit = down && !this.prev[id];
      this.prev[id] = down;
      return hit;
    };

    if (session) {
      for (const src of session.inputSources) {
        const gp = src.gamepad;
        if (!gp) continue;
        const sx = gp.axes[2] ?? 0, sy = gp.axes[3] ?? 0;
        if (src.handedness === 'left') {
          moveX = sx; moveZ = sy;
          out.x = edge('x', !!gp.buttons[4]?.pressed);
          out.y = edge('y', !!gp.buttons[5]?.pressed);
        } else if (src.handedness === 'right') {
          turn = sx;
          out.a = edge('a', !!gp.buttons[4]?.pressed);
          out.b = edge('b', !!gp.buttons[5]?.pressed);
        }
      }
    } else {
      const k = (c: string) => (this.keys.has(c) ? 1 : 0);
      moveX = k('d') - k('a');
      moveZ = k('s') - k('w');
      if (this.keys.has('shift')) { moveX *= 0.7; moveZ *= 0.7; }
      this.camera.rotation.set(-this.pitch, -this.yaw, 0, 'YXZ');
      out.a = edge('c', this.keys.has('c'));
      out.b = edge('v', this.keys.has('v'));
      out.x = edge('h', this.keys.has('h'));
    }

    this.camera.getWorldPosition(this.head);

    // Turn about where your head is, not about the centre of the room.
    if (Math.abs(turn) > 0.15) {
      const angle = -turn * TURN * dt;
      this.tmp.copy(this.head).sub(this.group.position).applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
      this.group.position.x = this.head.x - this.tmp.x;
      this.group.position.z = this.head.z - this.tmp.z;
      this.group.rotation.y += angle;
    }

    const push = Math.hypot(moveX, moveZ);
    if (push > 0.15) {
      const speed = push < 0.75 ? (WALK * (push - 0.15)) / 0.6 : WALK + ((STRIDE - WALK) * (push - 0.75)) / 0.25;
      this.camera.getWorldDirection(this.fwd);
      this.fwd.y = 0;
      this.fwd.normalize();
      const step = (speed * dt) / push;
      this.group.position.x += (-this.fwd.x * moveZ - this.fwd.z * moveX) * step;
      this.group.position.z += (-this.fwd.z * moveZ + this.fwd.x * moveX) * step;
    }

    // Stay inside the painted area, and stand on the ground under your head.
    this.group.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.head);
    const far = Math.hypot(this.head.x, this.head.z);
    if (this.blocked(this.head.x, this.head.z) && !this.blocked(this.was.x, this.was.z)) {
      this.group.position.x += this.was.x - this.head.x;
      this.group.position.z += this.was.z - this.head.z;
      this.head.copy(this.was);
    }
    this.was.copy(this.head);
    if (far > this.walkRadius) {
      const pull = this.walkRadius / far - 1;
      this.group.position.x += this.head.x * pull;
      this.group.position.z += this.head.z * pull;
    }
    const ground = this.heightAt(this.head.x, this.head.z);
    this.group.position.y += (ground - this.group.position.y) * Math.min(1, dt * 12);
    this.group.updateMatrixWorld(true);
    this.camera.getWorldPosition(this.head);
    return out;
  }
}
