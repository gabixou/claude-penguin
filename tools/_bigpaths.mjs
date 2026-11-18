import { execFileSync } from 'node:child_process';
const [from, to] = process.argv.slice(2);
const out = execFileSync('git', ['rev-list', '--objects', `${from}..${to}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
const lines = out.trim().split(/\r?\n/);
const ids = lines.map((l) => l.split(' ')[0]);
const paths = {};
for (const l of lines) { const i = l.indexOf(' '); if (i > 0) paths[l.slice(0, i)] = l.slice(i + 1); }
const sizes = {};
for (let i = 0; i < ids.length; i += 5000) {
    const chunk = ids.slice(i, i + 5000).join('\n') + '\n';
    const res = execFileSync('git', ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { input: chunk, encoding: 'utf8', maxBuffer: 1 << 28 });
    for (const line of res.trim().split('\n')) {
        const [oid, t, s] = line.split(' ');
        if (t !== 'blob') continue;
        const p = paths[oid] || '?';
        const dir = p.split('/').slice(0, 3).join('/');
        sizes[dir] = (sizes[dir] || 0) + parseInt(s, 10);
    }
}
const top = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [d, s] of top) console.log((s / 1048576).toFixed(0).padStart(6), 'MB', d);
