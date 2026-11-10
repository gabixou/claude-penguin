import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
const ROOT = 'client/public/assets/movies';
const rooms = ['town','coffee','dance','pizza','plaza','forts','dojo','beach','dock','lodge','mine','rink'];
for (const room of rooms) {
  const dir = path.join(ROOT, room);
  let tl;
  try { tl = JSON.parse(await readFile(path.join(dir, 'timelines.json'), 'utf8')); }
  catch (e) { console.log(room, 'NO timelines.json'); continue; }
  const need = [];
  if (tl.pack?.file) need.push(tl.pack.file);
  for (const f of tl.chunks?.files ?? []) need.push(f);
  for (const f of Object.values(tl.fonts ?? {})) if (f?.file) need.push(f.file);
  const missing = [];
  for (const f of need) {
    try { await access(path.join(dir, 'chars', f)); } catch { missing.push(f); }
  }
  const sprites = Object.keys(tl.sprites || {}).length;
  const chars = Object.keys(tl.characters || {}).length;
  const mainFrames = tl.main?.frames?.length || 0;
  console.log(room.padEnd(8), 'sprites:'+String(sprites).padStart(4), 'chars:'+String(chars).padStart(5),
    'frames:'+mainFrames, missing.length ? 'MISSING: ' + missing.join(',') : 'OK');
}
