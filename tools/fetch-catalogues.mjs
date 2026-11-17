// Baixa packs de catalogo do gopenguin (/swf/catalogue-<name>/) para
// client/public/assets/catalogues/<name>/ — mesmo formato dos rooms.
import fs from 'node:fs';
import path from 'node:path';
const BASE = 'https://gopenguin.lol/swf';
const OUT = 'client/public/assets/catalogues';
const names = process.argv.slice(2);
for (const name of names) {
  const dir = path.join(OUT, name);
  fs.mkdirSync(path.join(dir, 'chars'), { recursive: true });
  const tl = await fetch(`${BASE}/catalogue-${name}/timelines.json`).then(r => r.ok ? r.json() : null);
  if (!tl) { console.log(name, '404'); continue; }
  fs.writeFileSync(path.join(dir, 'timelines.json'), JSON.stringify(tl));
  const files = [];
  if (tl.pack?.file) files.push(tl.pack.file);
  for (const f of tl.chunks?.files ?? []) files.push(f);
  let ok = 0;
  for (const f of files) {
    const dest = path.join(dir, 'chars', f);
    if (fs.existsSync(dest)) { ok++; continue; }
    const buf = await fetch(`${BASE}/catalogue-${name}/chars/${f}`).then(r => r.ok ? r.arrayBuffer() : null);
    if (buf) { fs.writeFileSync(dest, Buffer.from(buf)); ok++; }
  }
  console.log(name, 'tl ok, packs', ok + '/' + files.length);
}
