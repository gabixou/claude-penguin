const r = await fetch('http://localhost:3000/src/scenes/BootScene.js');
const t = await r.text();
for (const kw of ['complete', 'scene.start', 'delayedCall', 'create()', 'preload()']) {
  const idx = []; let i = -1;
  while ((i = t.indexOf(kw, i + 1)) !== -1) idx.push(i);
  console.log(kw, idx.length);
}
// print create function region
const ci = t.indexOf('create()');
console.log(t.slice(ci, ci + 3000));
