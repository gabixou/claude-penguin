const fs = require('fs');
const path = require('path');
const dir = 'client/public/assets/movies/furniture';
// para cada item animado do catalogo, conta clips multi-frame dentro do art do frame_1 de cada rotacao
const cat = JSON.parse(fs.readFileSync('server/src/data/igloo-catalog.json', 'utf8'));
const animIds = Object.entries(cat.furniture).filter(([id, e]) => e.fps > 0).map(([id]) => id);
console.log('animated:', animIds.length);
const out = [];
for (const id of animIds) {
  const f = path.join(dir, id, 'timelines.json');
  if (!fs.existsSync(f)) { out.push(id + ':MISSING'); continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const main = j.main?.frames?.[0] || [];
  const itemE = main.find((e) => e.name === 'item') || main[0];
  const itemSp = j.sprites?.[String(itemE?.id)];
  if (!itemSp) { out.push(id + ':noitem'); continue; }
  // varre TODAS as rotacoes: clips descendentes com >1 frame
  let maxClip = 0, clipPaths = [];
  const walk = (entries, depth) => {
    for (const e of entries || []) {
      const sp = j.sprites?.[String(e.id)];
      if (!sp) continue;
      if (sp.frames.length > 1) { maxClip = Math.max(maxClip, sp.frames.length); clipPaths.push(`${e.id}:${sp.frames.length}f${sp.actions && Object.keys(sp.actions).length ? '+act' : ''}`); }
      for (const fr of sp.frames.slice(0, 2)) walk(fr, depth + 1); // amostra p/ nao explodir
    }
  };
  for (const fr of itemSp.frames) walk(fr, 0);
  out.push(`${id}:clips[${[...new Set(clipPaths)].slice(0, 6).join(',')}]`);
}
console.log(out.join('\n'));
