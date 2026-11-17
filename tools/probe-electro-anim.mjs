import { readFileSync } from 'fs';
import { join } from 'path';
const dir = 'client/public/assets/movies/games/fish/IceFishing';
const tl = JSON.parse(readFileSync(join(dir, 'timelines.json'), 'utf8'));
const sprites = tl.sprites;
const f38 = tl.main.frames[37];

// ids dos sprites nomeados relevantes
const ids = {};
for (const e of f38) if (e.name) ids[e.name] = e.id;
console.log('named ids:', JSON.stringify(ids));

// penguin: labels + frames do label electro
const pid = ids.penguin;
if (pid) {
  const sp = sprites[pid];
  console.log('penguin sprite', pid, 'frames:', sp.frames.length, 'labels:', JSON.stringify(sp.labels));
  // scriptFrames e actions
  console.log('penguin scriptFrames:', JSON.stringify(sp.scriptFrames).slice(0, 500));
  // actions por frame (se houver)
  for (const [k, v] of Object.entries(sp.actions ?? {})) {
    console.log('penguin action', k, ':', JSON.stringify(v).slice(0, 300));
  }
}

// hook sprite 186: frames 1-10 e actions
const hsp = sprites[ids.hook];
if (hsp) {
  console.log('hook frames:', hsp.frames.length, 'labels:', JSON.stringify(hsp.labels));
  for (const [k, v] of Object.entries(hsp.actions ?? {})) {
    console.log('hook action', k, ':', JSON.stringify(v).slice(0, 300));
  }
}
