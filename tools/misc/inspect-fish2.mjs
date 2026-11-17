import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('client/public/assets/movies/games/fish/IceFishing/timelines.json', 'utf8'));
console.log('exports:', JSON.stringify(d.exports).slice(0, 3000));
// sprite 306 = fish instances; dump its frames summary
for (const id of ['306','185','318','152','186','215','241','260','261','267','271','275','278','279','282','301','305','307','308','317','326','330','335','351','145','11']) {
  const s = d.sprites?.[id];
  if (!s) { console.log(id, 'MISSING'); continue; }
  console.log(`sprite ${id}: frames=${s.frames.length} labels=${JSON.stringify(s.labels||{})} actions=${JSON.stringify(s.actions||{})}`);
}
