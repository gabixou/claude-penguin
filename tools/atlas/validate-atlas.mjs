// T5.1/T5.2: valida cobertura do atlas (todo characters.file tem frame)
// e reporta tamanhos PNG vs packs SVG por dominio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'public', 'assets');
const DOMAINS = [
    ['movies/penguin', 1],
    ['movies/penguin-actions', 0],
    ['clothing', 0],
    ['paper', 0],
    ['icons', 0],
    ['movies/furniture', 0],
    ['movies/furniture-icon', 0],
    ['movies/igloo-wand', 0],
    ['movies/igloo-as2', 0],
];

function* walk(dir, depth = 0) {
    if (depth > 3) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (ents.some((e) => e.name === 'timelines.json')) { yield dir; return; }
    for (const e of ents) if (e.isDirectory()) yield* walk(path.join(dir, e.name), depth + 1);
}

const report = [];
for (const [dom] of DOMAINS) {
    const base = path.join(ROOT, dom);
    let movies = 0, withAtlas = 0, charsTotal = 0, covered = 0, missingSamples = [];
    let atlasBytes = 0, svgBytes = 0;
    for (const m of walk(base)) {
        movies++;
        const tlPath = path.join(m, 'timelines.json');
        let tl;
        try { tl = JSON.parse(fs.readFileSync(tlPath, 'utf8')); } catch { continue; }
        const files = new Set(Object.values(tl.characters || {}).map((c) => c?.file).filter(Boolean));
        charsTotal += files.size;
        const atlasPath = path.join(m, 'chars', 'atlas.json');
        if (!fs.existsSync(atlasPath)) { if (files.size) missingSamples.push(path.relative(ROOT, m)); continue; }
        withAtlas++;
        const at = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
        for (const f of files) if (at.frames?.[f]) covered++; else if (missingSamples.length < 5) missingSamples.push(`${path.relative(ROOT, m)}:${f}`);
        for (const s of at.sheets || []) {
            try { atlasBytes += fs.statSync(path.join(m, 'chars', s)).size; } catch {}
        }
        // svg bytes = packs
        for (const pf of [tl.pack?.file, ...(tl.chunks?.files || [])].filter(Boolean)) {
            try { svgBytes += fs.statSync(path.join(m, 'chars', pf)).size; } catch {}
        }
    }
    report.push({ dom, movies, withAtlas, charsTotal, covered, atlasMB: +(atlasBytes / 1048576).toFixed(1), svgMB: +(svgBytes / 1048576).toFixed(1), missing: missingSamples.slice(0, 5) });
}
console.log('domain'.padEnd(32), 'movies'.padStart(7), 'atlas'.padStart(7), 'chars'.padStart(8), 'covered'.padStart(9), 'atlasMB'.padStart(9), 'svgMB'.padStart(9));
for (const r of report) {
    console.log(r.dom.padEnd(32), String(r.movies).padStart(7), String(r.withAtlas).padStart(7), String(r.charsTotal).padStart(8), `${r.covered}/${r.charsTotal}`.padStart(9), String(r.atlasMB).padStart(9), String(r.svgMB).padStart(9));
    if (r.missing.length) console.log('   missing:', r.missing.join(', '));
}
