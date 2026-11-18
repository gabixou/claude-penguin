const fs = require('fs');
const j = JSON.parse(fs.readFileSync('client/public/assets/movies/furniture/132/timelines.json', 'utf8'));
const art = j.sprites['33'];
// dentro de cada frame do art, entries -> sprites com N frames?
for (let i = 0; i < art.frames.length; i++) {
  const fr = art.frames[i];
  const info = fr.map((e) => {
    const sp = j.sprites?.[String(e.id)];
    return `${e.name || '?'}#${e.id}:${sp ? sp.frames.length + 'f' : 'leaf'}`;
  });
  console.log('art frame', i + 1, '->', info.join(', '));
}
// actions de cada sprite-filho?
for (const e of art.frames[0]) {
  const sp = j.sprites?.[String(e.id)];
  if (sp?.actions && Object.keys(sp.actions).length) console.log('child', e.id, 'actions', JSON.stringify(sp.actions).slice(0, 200));
}
