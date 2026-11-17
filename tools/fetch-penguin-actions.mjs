// Baixa os "penguin-actions" (poses secret_frame >76 da dance/wave) de
// https://gopenguin.lol/swf/assets/penguin-actions/<frame>/ para
// client/public/assets/movies/penguin-actions/<frame>/.
// No cliente original (gp.js) il()/body() carregam esses movies sob demanda
// quando animationFrame retorna um secret_frame fora da timeline principal.
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../client/public/assets/movies/penguin-actions');
const BASE = 'https://gopenguin.lol/swf/assets/penguin-actions';

// Conjunto `ol` do gp.js: secret_frames que viram movies de acao.
// Derivado de penguin-action-frames.json (todo secret_frame >76 esta aqui).
const ACTION_FRAMES = [
    77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
    109, 110, 111, 112, 113, 114, 115, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
    131, 132, 133, 134, 135, 136, 138, 139, 140, 141, 142, 143, 144,
    153, 154, 155, 156, 157, 159, 160, 161,
];

async function get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r;
}

for (const frame of ACTION_FRAMES) {
    const dir = path.join(ROOT, String(frame), 'chars');
    await mkdir(dir, { recursive: true });
    const tlPath = path.join(ROOT, String(frame), 'timelines.json');
    let tl = null;
    try { tl = JSON.parse(await readFile(tlPath, 'utf8')); } catch {}
    if (!tl) {
        tl = await (await get(`${BASE}/${frame}/timelines.json`)).json();
        await writeFile(tlPath, JSON.stringify(tl));
    }
    const files = [];
    if (tl.pack?.file) files.push(`${BASE}/${frame}/chars/${tl.pack.file}`);
    for (const f of tl.chunks?.files ?? []) files.push(`${BASE}/${frame}/chars/${f}`);
    for (const f of Object.values(tl.fonts ?? {})) if (f?.file) files.push(`${BASE}/${frame}/chars/${f.file}`);
    // movies sem pack/chunks servem SVGs soltos em chars/<file> — o
    // original resolve base+file (Ih.source); baixar um a um
    if (!files.length) {
        const loose = new Set();
        for (const c of Object.values(tl.characters || {})) if (c?.file) loose.add(c.file);
        for (const f of Object.values(tl.fonts || {})) if (f?.file) loose.add(f.file);
        for (const f of loose) files.push(`${BASE}/${frame}/chars/${f}`);
    }
    for (const url of files) {
        const name = url.split('/').pop();
        const dest = path.join(dir, name);
        try { await access(dest); continue; } catch {}
        const buf = Buffer.from(await (await get(url)).arrayBuffer());
        await writeFile(dest, buf);
    }
    console.log(frame, 'OK');
}
console.log('done', ACTION_FRAMES.length);
