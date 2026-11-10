import { decodePNG } from './png.mjs';
import fs from 'node:fs';
for (const f of ['clone-town', 'ref-town']) {
  const img = decodePNG(fs.readFileSync(`tools/shots/${f}.png`));
  const ch = img.data.length === img.w * img.h * 3 ? 3 : 4;
  const avg = (x0, y0, w, h) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + h; y += 4) for (let x = x0; x < x0 + w; x += 4) {
      const i = (y * img.w + x) * ch;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
    return [r / n, g / n, b / n].map((v) => Math.round(v));
  };
  console.log(f, 'sky:', avg(200, 10, 400, 60), 'mid:', avg(200, 250, 400, 100), 'hud:', avg(200, 600, 400, 60));
}
