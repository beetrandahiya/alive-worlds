import * as THREE from 'three';

/**
 * Study-only readout on the left controller: frame rate and current settings.
 * Not part of the finished world.
 */
export class WristReadout {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private frames = 0;
  private since = 0;
  private worst = 0;
  private slow = 0;
  private lines: string[] = [];
  fps = 0;

  constructor(private build: string) {
    this.canvas.width = 512;
    this.canvas.height = 288;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.0675),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, toneMapped: false }),
    );
    this.mesh.position.set(0, 0.03, 0.06);
    this.mesh.rotation.set(-1.15, 0, 0);
    this.mesh.renderOrder = 100;
  }

  set(lines: string[]) {
    this.lines = lines;
  }

  /** Call once per frame with the frame's duration in seconds and the display's target rate. */
  tick(dt: number, target: number) {
    this.frames++;
    this.since += dt;
    this.worst = Math.max(this.worst, dt);
    if (dt > 1.5 / target) this.slow++;
    if (this.since < 1) return;
    this.fps = this.frames / this.since;
    const c = this.ctx;
    c.clearRect(0, 0, 512, 288);
    c.fillStyle = 'rgba(12, 16, 30, 0.82)';
    c.beginPath();
    c.roundRect(0, 0, 512, 288, 28);
    c.fill();
    c.fillStyle = this.fps > target - 1.5 ? '#f1e9a8' : '#ff9a7a';
    c.font = '600 84px system-ui, sans-serif';
    c.fillText(this.fps.toFixed(0), 28, 96);
    c.fillStyle = '#c8d2ee';
    c.font = '400 30px system-ui, sans-serif';
    c.fillText(`fps of ${target}`, 150, 62);
    c.fillText(`slow frames ${this.slow} · worst ${(this.worst * 1000).toFixed(0)} ms`, 150, 98);
    this.lines.forEach((l, i) => c.fillText(l, 28, 150 + i * 38));
    c.fillStyle = '#7f8bb0';
    c.font = '400 24px system-ui, sans-serif';
    c.fillText(this.build, 28, 268);
    this.tex.needsUpdate = true;
    this.frames = 0;
    this.since = 0;
    this.worst = 0;
    this.slow = 0;
  }
}
