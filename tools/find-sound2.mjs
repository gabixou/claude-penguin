import fs from 'node:fs';
const s = fs.readFileSync('E:/project/gopenguin-3ds-main/browser-src/client/dist/assets/index-BhZOxxXy.js', 'utf8');
// procura URLs de audio e mapas room->som
for (const pat of [/audio\/[A-Za-z0-9_\/.-]+/g, /\.mp3/g, /sound[A-Za-z]*\s*[:=]\s*[{[]/g, /town[^,}]{0,60}(mp3|sound|audio)/gi]) {
  const out = new Set(); let m;
  while ((m = pat.exec(s)) && out.size < 40) out.add(m[0]);
  console.log('=== ' + pat + ' ===');
  console.log([...out].join('\n'));
}
