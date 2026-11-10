import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/bub-full.png'));
const { w, h, data } = img;
const ch = data.length === w * h * 3 ? 3 : 4;
const px = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i+1], data[i+2]]; };
// coluna central x=640: perfil vertical de "branco"
for (let y = 280; y < 430; y += 2) {
  const [r, g, b] = px(640, y);
  const tag = (r > 230 && g > 230 && b > 230) ? 'W' : (r < 100 && g < 100 && b < 100) ? 'D' : '.';
  process.stdout.write(tag);
}
console.log('\n--- linhas escuras (texto) na faixa y 320-380, x 560-730 ---');
for (let y = 320; y < 385; y++) {
  let dark = 0;
  for (let x = 560; x < 730; x++) {
    const [r, g, b] = px(x, y);
    if (r < 100 && g < 100 && b < 100) dark++;
  }
  if (dark > 0) console.log('y=' + y, 'dark=' + dark);
}
