const fs = require('fs');
const base = 'E:/project/club-penguin-browser/client/public/assets/movies/';
for (const d of ['igloo', 'igloo-type/1', 'igloo-type/15']) {
  const t = JSON.parse(fs.readFileSync(base + d + '/timelines.json', 'utf8'));
  console.log('=====', d);
  console.log('main frames:', JSON.stringify(t.main?.frames ?? t.main).slice(0, 1500));
  console.log('sprites:', Object.keys(t.sprites || {}).join(','));
  console.log('characters:', JSON.stringify(t.characters).slice(0, 600));
}
