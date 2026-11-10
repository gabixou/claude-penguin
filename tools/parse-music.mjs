import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync('tools/ml.json', 'utf8'));
const w = j.parse.wikitext;
// cada row comeca com |- ; celulas em linhas | ...
const rows = [];
let cur = null;
for (const line of w.split('\n')) {
    if (line.startsWith('|-')) { if (cur) rows.push(cur); cur = []; continue; }
    if (!cur) continue;
    const m = line.match(/^\|\s*(.*)$/);
    if (!m) continue;
    let cell = m[1].trim();
    // remove templates de link de arquivo, fica so o numero/id
    const idm = cell.match(/music\/(\d+)\.swf/);
    if (idm) cell = idm[1];
    cell = cell.replace(/\[\[(.*?)\]\]/g, '$1').replace(/'''/g, '').trim();
    if (cell) cur.push(cell);
}
if (cur) rows.push(cur);
// colunas: [id, name, type, partyroom, location] (type pode ter rowspan -> desloca)
const out = [];
for (const r of rows) {
    if (!/^\d+$/.test(r[0] || '')) continue;
    out.push(r);
}
fs.writeFileSync('tools/music-rows.json', JSON.stringify(out, null, 1));
console.log('parsed rows:', out.length);
// mostra os que parecem Room
const rooms = out.filter(r => /room/i.test(r.join(' ')));
console.log('room-ish:', rooms.length);
console.log(JSON.stringify(rooms.slice(0, 40)));
