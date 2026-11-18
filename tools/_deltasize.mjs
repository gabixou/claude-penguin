import { execFileSync } from 'node:child_process';
const [from, to] = process.argv.slice(2);
const out = execFileSync('git', ['rev-list', '--objects', `${from}..${to}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
const ids = out.trim().split(/\r?\n/).map((l) => l.split(' ')[0]);
// batch-check em chunks
let total = 0, blobs = 0, n = 0;
for (let i = 0; i < ids.length; i += 5000) {
    const chunk = ids.slice(i, i + 5000).join('\n') + '\n';
    const res = execFileSync('git', ['cat-file', '--batch-check=%(objecttype) %(objectsize)'], { input: chunk, encoding: 'utf8', maxBuffer: 1 << 28 });
    for (const line of res.trim().split('\n')) {
        const [t, s] = line.split(' ');
        const sz = parseInt(s, 10) || 0;
        total += sz; n++;
        if (t === 'blob') blobs += sz;
    }
}
console.log(JSON.stringify({ objects: n, totalMB: (total / 1048576).toFixed(0), blobMB: (blobs / 1048576).toFixed(0) }));
