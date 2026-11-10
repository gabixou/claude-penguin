import { decodePNG } from './png.mjs';
import fs from 'node:fs';
for (const f of ['penguin-vector', 'penguin-walk']) {
  const img = decodePNG(fs.readFileSync('tools/shots/' + f + '.png'));
  const colors = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    const k = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    colors.set(k, (colors.get(k) || 0) + 1);
  }
  const top = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(f, 'w', img.w, 'h', img.h, 'unique', colors.size,
    'top:', top.map(([c, n]) => '#' + c.toString(16).padStart(6, '0') + ':' + n).join(' '));
  // scan center region for penguin-colored pixels (navy/white)
  let hits = 0;
  for (let y = 200; y < 380; y++) for (let x = 300; x < 460; x++) {
    const i = (y * img.w + x) * 4;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    if (b > 120 && b > r + 40 && b > g + 20) hits++;
  }
  console.log('  blue-ish px in region:', hits);
}
