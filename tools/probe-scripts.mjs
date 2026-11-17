import { readFileSync } from 'fs';
import { join } from 'path';
const dir = 'client/public/assets/movies/games/fish/IceFishing';
const tl = JSON.parse(readFileSync(join(dir, 'timelines.json'), 'utf8'));
const sprites = tl.sprites;
const s173 = sprites[173];
console.log('sprite 173 frames:', s173.frames.length, 'labels:', JSON.stringify(s173.labels));
console.log('actions:', JSON.stringify(s173.actions).slice(0, 800));
console.log('scriptFrames:', JSON.stringify(s173.scriptFrames));
// frame 16 e ultimos frames
for (const i of [0, 1, 14, 15, 16, s173.frames.length - 1]) {
  if (i >= 0 && i < s173.frames.length)
    console.log(`f${i + 1}:`, JSON.stringify(s173.frames[i]).slice(0, 300));
}
// onde mais o id 173 aparece? varrer todos os frames de todos os sprites + main
let hits = [];
for (const [id, sp] of Object.entries(sprites)) {
  sp.frames.forEach((fr, fi) => {
    fr.forEach(e => { if (e.id === 173) hits.push(`sprite ${id} frame ${fi + 1} depth ${e.depth} name=${e.name}`); });
  });
}
tl.main.frames.forEach((fr, fi) => {
  fr.forEach(e => { if (e.id === 173) hits.push(`main frame ${fi + 1} name=${e.name}`); });
});
console.log('173 occurrences:', hits);
