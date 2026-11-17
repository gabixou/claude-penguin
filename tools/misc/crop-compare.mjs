import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';
for (const [src, name] of [['room-mine', 'crop-mine-clone'], ['ref-mine', 'crop-mine-ref']]) {
  const img = decodePNG(fs.readFileSync('tools/shots/' + src + '.png'));
  const ch = img.data.length === img.w * img.h * 3 ? 3 : 4;
  const x0 = 40, y0 = 0, w = 420, h = 320;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y0 + y) * img.w + (x0 + x)) * ch, di = (y * w + x) * 4;
    out[di] = img.data[si]; out[di + 1] = img.data[si + 1]; out[di + 2] = img.data[si + 2];
    out[di + 3] = ch === 4 ? img.data[si + 3] : 255;
  }
  fs.writeFileSync('tools/shots/' + name + '.png', encodePNG(w, h, 4, out));
  let n = 0, sr = 0, sg = 0, sb = 0;
  const grid = new Map();
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
    const si = ((y0 + y) * img.w + (x0 + x)) * ch;
    const r = img.data[si], g = img.data[si + 1], b = img.data[si + 2];
    sr += r; sg += g; sb += b; n++;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); grid.set(k, (grid.get(k) || 0) + 1);
  }
  const top = [...grid.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(name, 'avg', Math.round(sr / n), Math.round(sg / n), Math.round(sb / n),
    'colors', grid.size, 'top', top.map(([k, v]) => k.toString(16) + ':' + v).join(' '));
}
