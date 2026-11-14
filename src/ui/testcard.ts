import * as THREE from 'three';

/** What the owner should judge in this study. Shown on the page and in the headset. */
export const TEST_LIST: [string, string][] = [
  ['Still a bare model', 'Only the town plan and the asylum size changed.'],
  ['The start view', 'Still close to the painting?'],
  ['Walk the streets', 'Down the lane to the front street, then along each street and cross lane. Does any road still run through a house, or any house into another or into the church?'],
  ['Is it a town?', 'Houses face the streets with doors on them. Does it feel like a place people built, or still like scattered boxes? Too straight and grid-like?'],
  ['Street widths', 'Church street is narrow (under 4 m); the front street is about 5 m. Right?'],
  ['The asylum', 'Now 78 m long, nearer its real size. Better, or too much?'],
  ['Wheat field', 'Moved left of the lane as a stand-in. Its real place is being researched; ignore it for now.'],
];

/** Study-only card above the left hand listing what to test. Y shows and hides it. */
export function testCard(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1100;
  const c = canvas.getContext('2d')!;
  c.fillStyle = 'rgba(12, 16, 30, 0.9)';
  c.beginPath();
  c.roundRect(0, 0, 1024, 1100, 44);
  c.fill();
  c.fillStyle = '#f1e9a8';
  c.font = '600 46px system-ui, sans-serif';
  c.fillText('What to test', 56, 92);
  let y = 172;
  TEST_LIST.forEach(([title, text], i) => {
    c.fillStyle = '#eef0f6';
    c.font = '600 34px system-ui, sans-serif';
    c.fillText(`${i + 1}.  ${title}`, 56, y);
    c.fillStyle = '#b9c3e6';
    c.font = '400 28px system-ui, sans-serif';
    const words = text.split(' ');
    let line = '';
    y += 40;
    for (const w of words) {
      if (c.measureText(line + w).width > 880) {
        c.fillText(line, 104, y);
        y += 36;
        line = '';
      }
      line += w + ' ';
    }
    c.fillText(line, 104, y);
    y += 58;
  });
  c.fillStyle = '#7f8bb0';
  c.font = '400 26px system-ui, sans-serif';
  c.fillText('Y hides this list', 56, 1060);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3 * (1100 / 1024)),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, toneMapped: false }),
  );
  mesh.position.set(0, 0.26, -0.04);
  mesh.rotation.set(-0.5, 0, 0);
  mesh.renderOrder = 100;
  mesh.visible = false;
  return mesh;
}
