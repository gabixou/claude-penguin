// Converte penguin-actions pack-less (chars/*.svg soltos) em chars.pack,
// mesmo formato dos movies packed (tl.pack = {file, entries:{f:[off,len]}}).
// Sem isso cada SVG e um fetch HTTP individual — a primeira dance que mapeia
// para um desses movies esperava centenas de requests (pinguim "congelava").
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'client/public/assets/movies/penguin-actions';
const nat = (a, b) => a.localeCompare(b, undefined, { numeric: true });

for (const dir of fs.readdirSync(ROOT)) {
    const cdir = path.join(ROOT, dir, 'chars');
    if (!fs.existsSync(cdir)) continue;
    const svgs = fs.readdirSync(cdir).filter((f) => f.endsWith('.svg')).sort(nat);
    if (!svgs.length) continue;
    const tlPath = path.join(ROOT, dir, 'timelines.json');
    const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
    if (tl.pack) { console.log(dir, 'ja packed'); continue; }

    const chunks = [];
    const entries = {};
    let off = 0;
    for (const f of svgs) {
        const buf = fs.readFileSync(path.join(cdir, f));
        entries[f] = [off, buf.length];
        chunks.push(buf);
        off += buf.length;
    }
    fs.writeFileSync(path.join(cdir, 'chars.pack'), Buffer.concat(chunks));
    tl.pack = { file: 'chars.pack', entries };
    fs.writeFileSync(tlPath, JSON.stringify(tl));
    for (const f of svgs) fs.unlinkSync(path.join(cdir, f));
    console.log(dir, 'packed', svgs.length, 'svgs,', off, 'bytes');
}
