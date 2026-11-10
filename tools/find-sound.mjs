import fs from 'node:fs';
const s = fs.readFileSync('E:/project/gopenguin-3ds-main/browser-src/client/dist/assets/index-BhZOxxXy.js', 'utf8');
const re = /["'`]([^"'`]{0,90}(?:mp3|wav|ogg|\.swf|sound|audio|music)[^"'`]{0,90})["'`]/gi;
const out = new Set();
let m;
while ((m = re.exec(s)) && out.size < 80) out.add(m[1]);
console.log([...out].join('\n'));
