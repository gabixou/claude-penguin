// Extrai floor_x/floor_y/wall_x/wall_y/wall_left/wall_right de cada
// igloo/igloos/<type>.swf (vars do frame_1 DoAction) -> igloo-spawns.json
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FFDEC = 'C:\\Program Files (x86)\\FFDec\\ffdec-cli.exe';
const ROOT = 'E:\\project\\club-penguin-browser';
const SRC = 'C:\\Users\\GABS\\wand\\legacy-media\\media\\play\\v2\\content\\global\\igloo\\igloos';
const OUT = path.join(ROOT, 'client', 'public', 'assets', 'igloo-spawns.json');

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.swf'));
const result = {};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'igloo-spawns-'));

for (const f of files) {
    const type = f.replace(/\.swf$/, '');
    const dir = path.join(tmp, type);
    fs.mkdirSync(dir, { recursive: true });
    try {
        execFileSync(FFDEC, ['-export', 'script', dir,
            path.join(SRC, f).replace(/\//g, '\\')], { stdio: 'pipe', timeout: 60000 });
        const asFile = path.join(dir, 'scripts', 'frame_1', 'DoAction.as');
        const as = fs.existsSync(asFile) ? fs.readFileSync(asFile, 'utf8') : '';
        const get = (n) => {
            const m = new RegExp(`var ${n} = (-?[\\d.]+)`).exec(as);
            return m ? parseFloat(m[1]) : undefined;
        };
        const e = {};
        for (const n of ['floor_x', 'floor_y', 'wall_x', 'wall_y', 'wall_left', 'wall_right']) {
            const v = get(n);
            if (v !== undefined) e[n] = v;
        }
        if (Object.keys(e).length) result[type] = e;
    } catch { /* ignore */ }
    fs.rmSync(dir, { recursive: true, force: true });
}
fs.writeFileSync(OUT, JSON.stringify(result));
console.log(`[spawns] DONE ${Object.keys(result).length} -> ${OUT}`);
