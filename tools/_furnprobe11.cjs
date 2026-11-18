const fs = require('fs');
const j = JSON.parse(fs.readFileSync('client/public/assets/movies/furniture/130/timelines.json', 'utf8'));
const item = j.sprites['19'];
item.frames.forEach((fr, i) => {
  const names = fr.map((e) => `${e.name || 'id' + e.id}#${e.id}`);
  console.log('item frame', i + 1, '->', names.join(', '));
  for (const e of fr) {
    const sp = j.sprites[String(e.id)];
    if (sp?.frames) {
      sp.frames.forEach((af, ai) => {
        const sub = af.map((x) => `${x.name || 'id' + x.id}#${x.id}`);
        console.log(`   ${e.name || 'id' + e.id} f${ai + 1} ->`, sub.join(', '));
      });
    }
  }
});
