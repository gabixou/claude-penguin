const fs = require('fs');
const j = JSON.parse(fs.readFileSync('client/public/assets/movies/furniture/130/timelines.json', 'utf8'));
const main = j.main?.frames?.[0] || [];
const itemE = main.find((e) => e.name === 'item') || main[0];
const itemSp = j.sprites?.[String(itemE?.id)];
console.log('item frames:', itemSp?.frames?.length);
const seen = new Set();
const walk = (entries, path, depth) => {
  if (depth > 8) return;
  for (const e of entries || []) {
    const key = String(e.id);
    const sp = j.sprites?.[key];
    if (!sp) continue;
    const p = path ? path + '.' + (e.name || '#' + e.id) : (e.name || '#' + e.id);
    if (sp.frames.length > 1 && !seen.has(p)) {
      seen.add(p);
      const acts = Object.entries(sp.actions || {}).map(([f, a]) => f + ':' + (a.source || '?').replace(/\s+/g, ' ').slice(0, 50));
      console.log(p.padEnd(40), sp.frames.length + 'f', 'acts[' + acts.join(' | ') + ']');
    }
    // desce todos os frames (animacao pode estar em qualquer um)
    for (const fr of sp.frames) walk(fr, p, depth + 1);
  }
};
for (const fr of itemSp.frames) walk(fr, 'item', 0);
