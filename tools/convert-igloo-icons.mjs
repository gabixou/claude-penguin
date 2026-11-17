// Converte os icons de mobília do legacy-media (furniture/icons/<id>.swf)
// para packs movie em client/public/assets/movies/furniture-icon/<id>/.
// Usados como thumbs do gridview original (browser de itens do igloo).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FFDEC = 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';
const NODE = process.execPath;
const ROOT = 'E:\\project\\club-penguin-browser';
const SRC = 'C:\\Users\\GABS\\wand\\legacy-media\\media\\play\\v2\\content\\global\\furniture\\icons';
const OUT = path.join(ROOT, 'client', 'public', 'assets', 'movies', 'furniture-icon');

fs.mkdirSync(OUT, { recursive: true });
const jobs = fs.readdirSync(SRC).filter((f) => f.endsWith('.swf'))
    .map((f) => f.replace(/\.swf$/, ''))
    .filter((n) => !fs.existsSync(path.join(OUT, n, 'timelines.json')))
    .map((n) => ({
        swf: path.join(SRC, n + '.swf').replace(/\//g, '\\'),
        out: path.join(OUT, n).replace(/\//g, '\\'),
        tag: n,
    }));

console.log(`[icons] ${jobs.length} restantes`);
let i = 0, fails = 0;
async function worker() {
    while (i < jobs.length) {
        const j = jobs[i++];
        try {
            execFileSync(NODE, [path.join(ROOT, 'tools', 'swf2movie.mjs'), j.swf, j.out, '--ffdec', FFDEC],
                { stdio: 'pipe', timeout: 120000, cwd: ROOT });
        } catch (e) {
            fails++;
            fs.appendFileSync(path.join(ROOT, 'tools', 'igloo-conv-fails.txt'), 'icon/' + j.tag + '\n');
        }
        if (i % 50 === 0) console.log(`[icons] ${i}/${jobs.length} fails=${fails}`);
    }
}
await Promise.all(Array.from({ length: 10 }, worker));
console.log(`[icons] DONE fails=${fails}`);
