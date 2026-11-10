import fs from 'node:fs';
import path from 'node:path';
import { decodeT3X, encodePNG } from './t3x2png.mjs';
const dir = process.argv[2];
const outdir = process.argv[3];
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.t3x'))) {
    const p = path.join(dir, f);
    try {
        const t = decodeT3X(fs.readFileSync(p));
        console.log(f, `${t.width}x${t.height}`, 'fmt=' + t.format, 'subs=' + t.numSub, 'mip ok');
        if (outdir) { fs.mkdirSync(outdir, { recursive: true }); fs.writeFileSync(path.join(outdir, f.replace('.t3x', '.png')), encodePNG(t.width, t.height, t.rgba)); }
    } catch (e) { console.log(f, 'ERRO:', e.message); }
}
