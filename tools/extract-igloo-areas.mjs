// Extrai as areas de colisao dos igloo types (igloo/igloos/<type>.swf):
// room_area, wall_area, pet_area (zonas validas de mobília) e trash_area
// (regiao "fora do iglu" que deleta o item no drag do editor original).
// Saida: client/public/assets/igloo-areas.json
//   { "<type>": { "room": {paths,matrix}, "wall": {...}, "pet": {...},
//                 "trash": {...} } }
// paths = SVG path data; matrix = [a,b,c,d,tx,ty] mundo (flash).
// No cliente: Path2D + isPointInPath com transform inversa = hitTest fiel.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FFDEC = 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';
const NODE = process.execPath;
const ROOT = 'E:\\project\\club-penguin-browser';
const SRC = 'C:\\Users\\GABS\\wand\\legacy-media\\media\\play\\v2\\content\\global\\igloo\\igloos';
const OUT = path.join(ROOT, 'client', 'public', 'assets', 'igloo-areas.json');

const mul = (P, G) => [
    P[0] * G[0] + P[2] * G[1],
    P[1] * G[0] + P[3] * G[1],
    P[0] * G[2] + P[2] * G[3],
    P[1] * G[2] + P[3] * G[3],
    P[0] * G[4] + P[2] * G[5] + P[4],
    P[1] * G[4] + P[3] * G[5] + P[5],
];

// extrai paths+regras de um svg FFDec: <g transform="matrix(...)"> aninhados
function parseSvg(file) {
    const d = fs.readFileSync(file, 'utf8');
    const out = [];
    const gRe = /<g\s+transform="matrix\(([^)]+)\)"[^>]*>/g;
    // simplificacao: FFDec gera um <g> por shape com matrix; paths dentro
    const groups = [...d.matchAll(/<g\s+transform="matrix\(([^)]+)\)">([\s\S]*?)<\/g>/g)];
    for (const g of groups) {
        const m = g[1].split(',').map(Number);
        const body = g[2];
        const pRe = /<path\s+d="([^"]+)"([^>]*)\/>/g;
        let pm;
        while ((pm = pRe.exec(body))) {
            const rule = /fill-rule="(evenodd|nonzero)"/.exec(pm[2])?.[1] || 'nonzero';
            out.push({ d: pm[1], rule, matrix: m });
        }
    }
    if (!out.length) {
        const pRe = /<path\s+d="([^"]+)"([^>]*)\/>/g;
        let pm;
        while ((pm = pRe.exec(d))) {
            const rule = /fill-rule="(evenodd|nonzero)"/.exec(pm[2])?.[1] || 'nonzero';
            out.push({ d: pm[1], rule, matrix: [1, 0, 0, 1, 0, 0] });
        }
    }
    return out;
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.swf'));
const result = {};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'igloo-areas-'));

for (const f of files) {
    const type = f.replace(/\.swf$/, '');
    const swf = path.join(SRC, f).replace(/\//g, '\\');
    const work = path.join(tmp, type);
    fs.mkdirSync(work, { recursive: true });
    const movieDir = path.join(work, 'movie');
    const shapeDir = path.join(work, 'shapes');
    try {
        execFileSync(NODE, [path.join(ROOT, 'tools', 'swf2movie.mjs'), swf, movieDir, '--ffdec', FFDEC],
            { stdio: 'pipe', timeout: 120000, cwd: ROOT });
        execFileSync(FFDEC, ['-format', 'shape:svg', '-export', 'shape', shapeDir, swf],
            { stdio: 'pipe', timeout: 60000 });
        const tl = JSON.parse(fs.readFileSync(path.join(movieDir, 'timelines.json'), 'utf8'));
        // main frame: nome -> sprite id + matrix
        const placed = {};
        for (const e of tl.main.frames[0] || []) {
            if (e.name) placed[e.name] = { sid: String(e.id), m: e.matrix || [1, 0, 0, 1, 0, 0] };
        }
        const entry = {};
        for (const area of ['room_area', 'wall_area', 'pet_area', 'trash_area']) {
            const p = placed[area];
            if (!p) continue;
            // sprite -> filho (char) no frame 0
            const sp = tl.sprites?.[p.sid];
            const child = sp?.frames?.[0]?.find((c) => c.id != null);
            if (!child) continue;
            const cid = String(child.id);
            const svgFile = path.join(shapeDir, cid + '.svg');
            if (!fs.existsSync(svgFile)) continue;
            const paths = parseSvg(svgFile).map((pp) => ({
                d: pp.d,
                rule: pp.rule,
                // o <g transform> do SVG FFDec e so normalizacao do viewport
                // (translada p/ coords positivas) — as coords do path ja
                // sao as coords Flash reais (podem ser negativas). O matrix
                // mundo e apenas o da colocacao do sprite.
                matrix: p.m,
            }));
            if (paths.length) entry[area.replace('_area', '')] = { paths };
        }
        if (Object.keys(entry).length) result[type] = entry;
    } catch (e) {
        console.log(`[areas] FAIL ${type}: ${String(e).slice(0, 120)}`);
    }
    fs.rmSync(work, { recursive: true, force: true });
    if (Number(type) % 10 === 0) console.log(`[areas] ${type}/${files.length}`);
}

fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`[areas] DONE ${Object.keys(result).length} tipos -> ${OUT}`);
