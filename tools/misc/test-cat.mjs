import fs from 'node:fs';
for (const k of ['furn2008', 'igloocat2008']) {
    const p = 'client/public/assets/catalogues/' + k + '/timelines.json';
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const m = d.main || d._mainTl;
    const buys = Object.values(d.buttonActions || {}).map((a) => JSON.stringify(a)).join(' ');
    const kinds = [...new Set([...buys.matchAll(/INTERFACE\.(\w+)/g)].map((x) => x[1]))];
    console.log(k, 'frames=' + m.frames.length, 'sprites=' + Object.keys(d.sprites || {}).length,
        'btnActions=' + Object.keys(d.buttonActions || {}).length, 'kinds=' + kinds.join(','));
}