const fs = require('fs');
const j = JSON.parse(fs.readFileSync('client/public/assets/movies/furniture/130/timelines.json', 'utf8'));
// acha sprites com 45 frames e suas actions
for (const [id, sp] of Object.entries(j.sprites)) {
  if (sp.frames?.length === 45) {
    console.log('sprite', id, '45f actions:', JSON.stringify(sp.actions).slice(0, 300));
  }
}
// arte frame 1-> entries 2; sprite 2 frames?
const s2 = j.sprites['2'];
console.log('sprite2 frames:', s2?.frames?.length);
s2?.frames?.forEach((fr, i) => console.log(' s2 frame', i + 1, '->', fr.map((e) => e.id).join(',')));
