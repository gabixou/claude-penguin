const fs = require('fs');
const j = JSON.parse(fs.readFileSync('client/public/assets/movies/furniture/130/timelines.json', 'utf8'));
// quem referencia sprite 12?
for (const [id, sp] of Object.entries(j.sprites)) {
  if (!sp.frames) continue;
  sp.frames.forEach((fr, fi) => {
    fr.forEach((e) => { if (String(e.id) === '12') console.log('sprite', id, 'frame', fi + 1, 'refs #12 name=', e.name); });
  });
}
// e o que sao sprites 3 e 4 (entries do art)?
for (const id of ['3', '4']) {
  const sp = j.sprites[id];
  console.log('sprite', id, 'frames:', sp?.frames?.length);
  sp?.frames?.slice(0, 3).forEach((fr, i) => console.log('  f' + (i + 1), fr.map((e) => e.id).join(',')));
}
