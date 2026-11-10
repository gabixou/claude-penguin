import { decodePNG } from './png.mjs';
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const img = decodePNG(fs.readFileSync(f));
  const ch = img.data.length === img.w * img.h * 3 ? 3 : 4;
  let r = 0, g = 0, b = 0, n = 0, transp = 0;
  for (let i = 0; i < img.data.length; i += ch * 37) {
    r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    if (ch === 4 && img.data[i + 3] < 10) transp++;
  }
  console.log(f.split('/').pop(), img.w + 'x' + img.h,
    'avg', [r / n, g / n, b / n].map(v => Math.round(v)).join(','),
    'transp%', Math.round(transp / n * 100));
}
