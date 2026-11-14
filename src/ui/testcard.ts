import * as THREE from 'three';

/** What the owner should judge in this study. Shown on the page and in the headset. */
export const TEST_LIST: [string, string][] = [
  ['Still a bare model', 'Changed: the field wall, the streets, and the asylum.'],
  ['The field wall', 'Now one smooth low wall riding the ground, pale blue-grey as he painted it, about waist high. Is the jaggedness gone? Height right?'],
  ['The streets', 'They wander now and their edges are uneven. Enough character, too much, or still too straight?'],
  ['Houses and streets', 'Houses follow the bends. Does any street touch or run through a house?'],
  ['The asylum', 'Turn round at the start and walk up to it. Built from his paintings: ochre walls, green shutters, red tiled roof, a door with a balcony; the grey chapel and its short square tower to the right. Does it read as his asylum?'],
  ['The start view', 'Still the painting?'],
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
