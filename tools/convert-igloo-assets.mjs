// Converte em lote SWFs do igloo (locations/flooring/furniture) para packs movie.
// Uso: node tools/convert-igloo-assets.mjs [furniture|flooring|locations|all]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FFDEC = 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';
const NODE = process.execPath;
const ROOT = 'E:\\project\\club-penguin-browser';
const WAND = 'C:\\Users\\GABS\\wand\\vanilla-media\\media\\play\\v2\\content\\global\\igloo';
const OUT = path.join(ROOT, 'client', 'public', 'assets', 'movies');

const which = process.argv[2] || 'all';
const jobs = [];

function add(dir, nameFn, outFn) {
    const abs = path.join(WAND, dir);
    if (!fs.existsSync(abs)) return;
    for (const f of fs.readdirSync(abs)) {
        if (!f.endsWith('.swf')) continue;
        const n = f.replace(/\.swf$/, '');
        jobs.push({
            swf: path.join(abs, f).replace(/\//g, '\\'),
            out: path.join(OUT, outFn(n)).replace(/\//g, '\\'),
            tag: `${dir}/${f}`,
        });
    }
}

if (which === 'all' || which === 'locations') {
    // locations/sprites/N.swf -> movies/igloo-locN (interior tematico)
    const abs = path.join(WAND, 'locations', 'sprites');
    if (fs.existsSync(abs)) for (const f of fs.readdirSync(abs)) {
        if (!f.endsWith('.swf')) continue;
        const n = f.replace(/\.swf$/, '');
        jobs.push({ swf: path.join(abs, f).replace(/\//g, '\\'), out: path.join(OUT, `igloo-loc${n}`).replace(/\//g, '\\'), tag: `loc/${f}` });
    }
}
if (which === 'all' || which === 'flooring') {
    add('flooring', (n) => n, (n) => `igloo-floor${n}`);
}
if (which === 'all' || which === 'furniture') {
    const abs = 'C:\\Users\\GABS\\wand\\vanilla-media\\media\\play\\v2\\content\\global\\furniture\\sprites';
    if (fs.existsSync(abs)) for (const f of fs.readdirSync(abs)) {
        if (!f.endsWith('.swf')) continue;
        const n = f.replace(/\.swf$/, '');
        jobs.push({ swf: path.join(abs, f).replace(/\//g, '\\'), out: path.join(OUT, 'furniture', n).replace(/\//g, '\\'), tag: `furn/${f}` });
    }
}

console.log(`[conv] ${jobs.length} SWFs para converter`);
let i = 0, fails = 0;
const PAR = 6;
async function worker() {
    while (i < jobs.length) {
        const j = jobs[i++];
        try {
            execFileSync(NODE, [path.join(ROOT, 'tools', 'swf2movie.mjs'), j.swf, j.out, '--ffdec', FFDEC],
                { stdio: 'pipe', timeout: 120000, cwd: ROOT });
        } catch (e) {
            fails++;
            fs.appendFileSync(path.join(ROOT, 'tools', 'igloo-conv-fails.txt'), j.tag + '\n');
        }
        if (i % 50 === 0) console.log(`[conv] ${i}/${jobs.length} (fails=${fails})`);
    }
}
await Promise.all(Array.from({ length: PAR }, worker));
console.log(`[conv] DONE ${jobs.length} fails=${fails}`);
