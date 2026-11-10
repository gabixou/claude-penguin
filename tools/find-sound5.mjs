import fs from 'fs';
const files = fs.readdirSync('E:/project/gopenguin-3ds-main/browser-src/client/dist/assets').filter(f => f.endsWith('.js'));
for (const f of files) {
  const s = fs.readFileSync('E:/project/gopenguin-3ds-main/browser-src/client/dist/assets/' + f, 'utf8');
  for (const needle of ['new Audio', 'Audio(', 'music/', 'room-music', 'playMusic', 'soundManager', 'Howl', 'sfx/']) {
    let i = s.indexOf(needle);
    if (i >= 0) console.log(f, needle, '@' + i, '::', s.slice(Math.max(0, i - 120), i + 160).replace(/\n/g, ' ').slice(0, 280));
  }
}
