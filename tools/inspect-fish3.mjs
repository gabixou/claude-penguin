import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('client/public/assets/movies/games/fish/IceFishing/timelines.json', 'utf8'));
const chars = d.characters || {}, sprites = d.sprites || {};
for (const id of ['306','185','318','275','278','279','301','267','271','317','260','261','307','308','152','186','215','241','326','330','335','351','145','11','282']) {
  const s = sprites[id];
  if (!s) { console.log(id, 'not a sprite'); continue; }
  const stats = { char: 0, spr: 0, other: 0, names: new Set() };
  const sample = [];
  for (const fr of s.frames.slice(0, 6)) {
    for (const e of fr) {
      const sid = String(e.id);
      if (chars[sid]) stats.char++; else if (sprites[sid]) stats.spr++; else stats.other++;
      if (e.name) stats.names.add(e.name);
      if (sample.length < 8) sample.push(`${e.name || ''}:${sid}${chars[sid] ? '(c)' : sprites[sid] ? '(s)' : '(?)'}`);
    }
  }
  console.log(`sprite ${id}: frames=${s.frames.length} chars=${stats.char} subs=${stats.spr} other=${stats.other} names=[${[...stats.names].join(',')}] sample=${sample.join(' ')}`);
}
// check a character entry shape
const c = chars['8'] || Object.values(chars)[0];
console.log('char sample:', JSON.stringify(c).slice(0, 300));
console.log('pack entries sample:', JSON.stringify(Object.entries(d.pack?.entries || {}).slice(0, 3)));
console.log('pack file:', d.pack?.file, 'chunks:', JSON.stringify(d.chunks?.files));
