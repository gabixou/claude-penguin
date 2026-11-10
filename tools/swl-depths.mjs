import { readFileSync } from 'node:fs';
import { loadSwl, SwlScene, ROOT } from '../client/src/swl/swl.js';
const dir = new URL('../client/public/assets/scenes/', import.meta.url);
for (const name of process.argv.slice(2)) {
  const buf = readFileSync(new URL(name + '.swl', dir));
  const scene = new SwlScene(loadSwl(new Uint8Array(buf)));
  scene.prepare();
  const roots = scene.s.draw.filter(d => d.type === ROOT);
  console.log(name, 'draws:', scene.s.draw.length, 'roots:', roots.length,
    'depths:', roots.map(r => r.depth).join(', '));
}
