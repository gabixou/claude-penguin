import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../client/public/assets/clothing');
const ids = process.argv.slice(2);
const BASE = 'https://gopenguin.lol/swf/assets/clothing/sprites';
async function get(url) { const r = await fetch(url); if (!r.ok) return null; return r; }
for (const id of ids) {
  const dir = path.join(ROOT, id, 'chars');
  await mkdir(dir, { recursive: true });
  const tlPath = path.join(ROOT, id, 'timelines.json');
  let tl = null;
  try { tl = JSON.parse(await readFile(tlPath, 'utf8')); } catch {}
  if (!tl) {
    const _r = await get(BASE + '/' + id + '/timelines.json'); if (!_r) { console.log(id, 'MISS'); continue; } tl = await _r.json();
    await writeFile(tlPath, JSON.stringify(tl));
  }
  const files = [];
  if (tl.pack?.file) files.push(BASE + '/' + id + '/chars/' + tl.pack.file);
  for (const f of tl.chunks?.files ?? []) files.push(BASE + '/' + id + '/chars/' + f);
  for (const f of Object.values(tl.fonts ?? {})) if (f?.file) files.push(BASE + '/' + id + '/chars/' + f.file);
  for (const url of files) {
    const name = url.split('/').pop();
    const dest = path.join(dir, name);
    try { await access(dest); continue; } catch {}
    const _b = await get(url); if (!_b) continue; const buf = Buffer.from(await _b.arrayBuffer());
    await writeFile(dest, buf);
  }
  console.log(id, 'OK');
}
