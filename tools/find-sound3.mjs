import fs from 'node:fs';
const s = fs.readFileSync('E:/project/gopenguin-3ds-main/browser-src/client/dist/assets/index-BhZOxxXy.js', 'utf8');
// contexto ao redor de .mp3 e de 'sounds=['
for (const needle of ['.mp3', 'sounds=[']) {
  let i = -1, n = 0;
  while ((i = s.indexOf(needle, i + 1)) !== -1 && n < 8) {
    console.log('=== ' + needle + ' @' + i + ' ===');
    console.log(s.slice(Math.max(0, i - 300), i + 200).replace(/\n/g, ' '));
    console.log('');
    n++;
  }
}
