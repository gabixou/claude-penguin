import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const GIT = 'E:\\Git\\cmd\\git.exe';
const cwd = 'E:\\project\\club-penguin-browser';
const shas = fs.readFileSync('E:\\project\\club-penguin-browser\\tools\\_shas.txt', 'utf8').trim().split(/\r?\n/);
const BATCH = 1;
for (let i = 0; i < shas.length; i += BATCH) {
    const target = shas[Math.min(i + BATCH, shas.length) - 1];
    process.stdout.write(`batch ${i / BATCH + 1}: push ate ${target.slice(0, 9)}... `);
    try {
        const out = execFileSync(GIT, ['push', 'origin', target + ':refs/heads/dev'], { cwd, encoding: 'utf8', timeout: 1800000, stdio: ['ignore', 'pipe', 'pipe'] });
        console.log('OK', out.trim().split('\n').pop());
    } catch (e) {
        console.log('FAIL', (e.stderr || e.message || '').toString().slice(-400));
        process.exit(1);
    }
}
console.log('DONE all batches');
