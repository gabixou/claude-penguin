const fs = require('fs');
const j = JSON.parse(fs.readFileSync('client/public/assets/movies/furniture/130/timelines.json', 'utf8'));
const art = j.sprites['5']; // item.art
console.log('art frames:', art.frames.length);
art.frames.forEach((fr, i) => {
  const has12 = fr.some((e) => String(e.id) === '12');
  console.log('art frame', i + 1, 'entries:', fr.map((e) => e.id).join(','), 'has#12:', has12);
});
// sprite 12: actions completos
const s12 = j.sprites['12'];
console.log('s12 actions:', JSON.stringify(s12.actions, null, 1).slice(0, 1200));
