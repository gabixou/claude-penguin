import fs from 'node:fs';
const s = fs.readFileSync('E:/project/gopenguin-3ds-main/browser-src/client/dist/assets/index-BhZOxxXy.js', 'utf8');
for (const needle of ['Howl', 'howl', 'playSound', 'roomSound', 'ambient', 'soundId', 'music_']) {
  let i = -1, n = 0;
  while ((i = s.indexOf(needle, i + 1)) !== -1 && n < 5) {
    console.log('=== ' + needle + ' @' + i + ' ===');
    console.log(s.slice(Math.max(0, i - 250), i + 250).replace(/\n/g, ' '));
    console.log('');
    n++;
  }
}
