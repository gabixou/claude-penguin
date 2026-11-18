const fs = require('fs');
const j = JSON.parse(fs.readFileSync('client/public/assets/movies/furniture/130/timelines.json', 'utf8'));
const main = j.main?.frames?.[0] || [];
const itemE = main.find((e) => e.name === 'item') || main[0];
const itemSp = j.sprites?.[String(itemE?.id)];
console.log('item frames:', itemSp?.frames?.length);
// percorre TODA a arvore do frame 1 coletando clips e suas actions
const seen = new Set();
const walk = (entries, path) => {
  for (const e of entries || []) {
    const sp = j.sprites?.[String(e.id)];
    if (!sp || seen.has(String(e.id))) continue;
    seen.add(String(e.id));
    const p = path ? path + '.' + (e.name || '#' + e.id) : (e.name || '#' + e.id);
    if (sp.frames.length > 1) {
      const acts = Object.entries(sp.actions || {}).map(([f, a]) => f + ':' + (a.source || JSON.stringify(a)).replace(/\s+/g, ' ').slice(0, 60));
      console.log(p, 'sprite', e.id, sp.frames.length + 'f', 'acts[' + acts.join(' | ') + ']');
    }
    for (const fr of sp.frames.slice(0, 3)) walk(fr, p);
  }
};
for (const fr of itemSp.frames.slice(0, 1)) walk(fr, 'item');
