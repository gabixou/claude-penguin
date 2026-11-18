const fs = require('fs');
const path = require('path');
const dir = 'client/public/assets/movies/furniture';
for (const id of ['132', '136', '147', '101', '84', '119', '154']) {
  const f = path.join(dir, id, 'timelines.json');
  if (!fs.existsSync(f)) { console.log(id, 'MISSING'); continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const main = j.main?.frames?.[0] || [];
  const itemE = main.find((e) => e.name === 'item') || main[0];
  const itemSp = j.sprites?.[String(itemE?.id)];
  const nF1 = itemSp?.frames?.length || 0;
  // art do frame 1
  const fr1 = itemSp?.frames?.[0] || [];
  const artE = fr1.find((e) => e.name === 'art');
  const artSp = artE && j.sprites?.[String(artE.id)];
  const acts = artSp?.actions ? JSON.stringify(artSp.actions) : '{}';
  const sf = JSON.stringify(artSp?.scriptFrames || []);
  console.log(id, 'itemFrames=' + nF1, 'artFrames=' + (artSp?.frames?.length || 0), 'artActions=' + acts.slice(0, 200), 'scriptFrames=' + sf);
}
