import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/pc-front.png'));
const ch = img.data.length === img.w * img.h * 3 ? 3 : 4;
const x0 = 440, y0 = 140, w = 400, h = 420;
const out = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const si = ((y0 + y) * img.w + (x0 + x)) * ch, di = (y * w + x) * 4;
  out[di] = img.data[si]; out[di+1] = img.data[si+1]; out[di+2] = img.data[si+2];
  out[di+3] = ch === 4 ? img.data[si+3] : 255;
}
fs.writeFileSync('tools/shots/pc-crop.png', encodePNG(w, h, 4, out));
console.log('done');
