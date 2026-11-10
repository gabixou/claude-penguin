import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/bub-full.png'));
const { w, h, data } = img;
const ch = data.length === w * h * 3 ? 3 : 4;
const px = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i+1], data[i+2]]; };
// regiao do balao: x 560-730, y 300-400
// encontra linhas com pixels "quase brancos" (balao branco translúcido sobre fundo)
// e pixels escuros (texto)
for (let y = 300; y < 410; y += 4) {
  let white = 0, dark = 0;
  for (let x = 560; x < 730; x++) {
    const [r, g, b] = px(x, y);
    if (r > 225 && g > 225 && b > 225) white++;
    if (r < 90 && g < 90 && b < 90) dark++;
  }
  console.log(y, 'white:' + String(white).padStart(3), 'dark:' + String(dark).padStart(3));
}
