import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const f = process.argv[2] || 'tools/shots/clone-town.png';
const img = decodePNG(fs.readFileSync(f));
console.log('size', img.w, img.h);
// count green-ish pixels and their bbox
let greens = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
const top = new Map();
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
  const i = (y * img.w + x) * 4;
  const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
  const k = (r << 16) | (g << 8) | b;
  top.set(k, (top.get(k) || 0) + 1);
  if (g > 120 && g > r * 1.4 && g > b * 1.4) {
    greens++;
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
}
console.log('green-ish px:', greens, greens ? `bbox ${minx},${miny}-${maxx},${maxy}` : '');
console.log('top colors:', [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .map(([c, n]) => '#' + c.toString(16).padStart(6, '0') + ':' + n).join(' '));
