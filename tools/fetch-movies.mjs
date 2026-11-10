// Baixa timelines.json + arte (chars.pack/chunks/fontes) de https://gopenguin.lol/swf/<pack>/
// para client/public/assets/movies/<pack>/ — assets vetoriais (SVG) do cliente web.
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../client/public/assets/movies');
const packs = process.argv.slice(2);
const LIST = packs.length ? packs : ['town','coffee','dance','pizza','plaza','forts','dojo','beach','dock','lodge','mine','rink'];
const BASE = 'https://gopenguin.lol/swf';

async function get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r;
}

for (const pack of LIST) {
    const dir = path.join(ROOT, pack, 'chars');
    await mkdir(dir, { recursive: true });
    const tlPath = path.join(ROOT, pack, 'timelines.json');
    let tl = null;
    try { tl = JSON.parse(await readFile(tlPath, 'utf8')); } catch {}
    if (!tl) {
        tl = await (await get(`${BASE}/${pack}/timelines.json`)).json();
        await writeFile(tlPath, JSON.stringify(tl));
    }
    const files = [];
    if (tl.pack?.file) files.push(`${BASE}/${pack}/chars/${tl.pack.file}`);
    for (const f of tl.chunks?.files ?? []) files.push(`${BASE}/${pack}/chars/${f}`);
    for (const f of Object.values(tl.fonts ?? {})) if (f?.file) files.push(`${BASE}/${pack}/chars/${f.file}`);
    for (const url of files) {
        const name = url.split('/').pop();
        const dest = path.join(dir, name);
        try { await access(dest); continue; } catch {}
        const buf = Buffer.from(await (await get(url)).arrayBuffer());
        await writeFile(dest, buf);
        console.log(' ', pack, name, buf.length);
    }
    console.log(pack, 'OK');
}
