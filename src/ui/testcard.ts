import * as THREE from 'three';

/** What the owner should judge in this study. Shown on the page and in the headset. */
export const TEST_LIST: [string, string][] = [
  ['The church', 'A gable now faces you right under the spire, with his dark arched opening in it. The belfry sits on the roof behind it. Is this the church you meant?'],
  ['The spire', 'It should now be spire paint all the way up, no sky on it.'],
  ['Dark lines', 'His dark line runs along every roof edge, eave and corner. Look at the houses in the back rows: do they hold together now? Too heavy anywhere?'],
  ['Trees', 'Each painted tree is now a clump of rounded masses with big strokes standing off it. From 30 m, and right beside one: closer to the cypress, or still a painted ball?'],
  ['Behind the start', 'The asylum is hidden. Is the view behind you all right without it?'],
  ['Frame rate', 'About 27,000 strokes were added that are always drawn. Still 72 everywhere, especially by the trees on the right?'],
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
