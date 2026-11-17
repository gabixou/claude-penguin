import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/bubble-test.png'));
const ch = img.data.length === img.w * img.h * 3 ? 3 : 4;
function crop(name, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y0 + y) * img.w + (x0 + x)) * ch, di = (y * w + x) * 4;
    out[di] = img.data[si]; out[di+1] = img.data[si+1]; out[di+2] = img.data[si+2];
    out[di+3] = ch === 4 ? img.data[si+3] : 255;
  }
  fs.writeFileSync('tools/shots/' + name, encodePNG(w, h, 4, out));
}
crop('bubble-crop.png', 480, 180, 340, 220);
console.log('done', img.w, img.h);
