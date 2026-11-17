import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../client/public/assets/movies/games/fish/IceFishing');
const BASE = 'https://gopenguin.lol/swf/games/fish/IceFishing';
const EXTRA = ['title', 'canoworms'];

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}

async function fetchPack(dir, base) {
  await mkdir(dir, { recursive: true });
  const tlPath = path.join(dir, 'timelines.json');
  let tl = null;
  try { tl = JSON.parse(await readFile(tlPath, 'utf8')); } catch {}
  if (!tl) {
    tl = await (await get(`${base}/timelines.json`)).json();
    await writeFile(tlPath, JSON.stringify(tl));
  }
  const files = [];
  if (tl.pack?.file) files.push(`${base}/chars/${tl.pack.file}`);
  for (const f of tl.chunks?.files ?? []) files.push(`${base}/chars/${f}`);
  for (const f of Object.values(tl.fonts ?? {})) if (f?.file) files.push(`${base}/chars/${f.file}`);
  for (const url of files) {
    const name = url.split('/').pop();
    const dest = path.join(dir, 'chars', name);
    await mkdir(path.dirname(dest), { recursive: true });
    try { await access(dest); continue; } catch {}
    const buf = Buffer.from(await (await get(url)).arrayBuffer());
    await writeFile(dest, buf);
    console.log(' ', name, buf.length);
  }
  console.log(dir.split('/').slice(-2).join('/'), 'OK');
}

await fetchPack(ROOT, BASE);
for (const ex of EXTRA) {
  await fetchPack(path.join(ROOT, 'lang/en', ex), `https://gopenguin.lol/swf/games/fish/lang/en/${ex}`);
}
