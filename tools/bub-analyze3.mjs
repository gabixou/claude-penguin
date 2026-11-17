import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('tools/shots/bub-full.png'));
const { w, h, data } = img;
const ch = data.length === w * h * 3 ? 3 : 4;
const lum = (x, y) => { const i = (y * w + x) * ch; return 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]; };
// fundo local: media de luminancia na moldura ao redor da regiao do balao
// regiao estimada x 560-730 y 300-400. Amostra fundo em x 500-560 e 730-790
let bg = 0, n = 0;
for (let y = 310; y < 390; y++) for (const x of [520, 540, 750, 770]) { bg += lum(x, y); n++; }
bg /= n;
console.log('bg lum ~', bg.toFixed(0));
// bounding box dos pixels mais claros que bg+25 dentro de x540-760 y290-420
let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, cnt = 0;
for (let y = 290; y < 430; y++) for (let x = 540; x < 780; x++) {
  if (lum(x, y) > bg + 25) { cnt++; if (x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
}
console.log('bright blob:', { minX, maxX, minY, maxY, cnt });
// perfil vertical do blob na coluna central do bbox
const cx = Math.floor((minX + maxX) / 2);
for (let y = minY - 5; y < maxY + 10; y += 3) {
  let row = '';
  for (let x = minX; x <= maxX; x += Math.max(1, Math.floor((maxX-minX)/40))) {
    const l = lum(x, y);
    row += l > bg + 25 ? '#' : (l < 120 ? 'T' : '.');
  }
  console.log(String(y).padStart(3), row);
}
