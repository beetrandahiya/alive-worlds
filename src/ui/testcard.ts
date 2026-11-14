import * as THREE from 'three';

/** What the owner should judge in this study. Shown on the page and in the headset. */
export const TEST_LIST: [string, string][] = [
  ['Only the valley floor beyond the painting changed', 'It now wears the paint of his groves, all the way round to the foot of the hills.'],
  ['Frame rate', 'About 253,000 strokes, a little over what we have tested. Still 72?'],
  ['Base of the hills', 'Is the blurred, empty band gone?'],
  ['From the start, turn a full circle', 'Does the valley read as painted land? Too busy, too pale, or right?'],
  ['Flicker', 'More, less or the same as before on the valley?'],
  ['Walk down', 'The new strokes are sized for the start view and fade as you near them. Anything odd, such as giant strokes?'],
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
