import { readdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../client/public/assets/icons');
const ids = [];
for (const d of await readdir(ROOT, { withFileTypes: true })) {
  if (!d.isDirectory() || !/^\d+$/.test(d.name)) continue;
  try {
    await access(path.join(ROOT, d.name, 'timelines.json'));
    ids.push(Number(d.name));
  } catch {}
}
ids.sort((a, b) => a - b);
await writeFile(path.join(ROOT, 'index.json'), JSON.stringify(ids));
console.log('icons/index.json:', ids.length, 'ids');
