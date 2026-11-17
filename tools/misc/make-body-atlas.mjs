// Gera penguin-body.png: silhueta SOLIDA (alpha=255) onde o detail tem alpha>0.
// O detail do gopenguin e semitransparente (alpha~51/170) de proposito;
// o body precisa ser opaco para o tint sólido funcionar como no C2D_TintSolid.
import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';

const src = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-atlas.png'));
const px = Buffer.from(src.data);
for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 0) { px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = 255; }
}
const png = encodePNG(src.w, src.h, 4, px);
fs.writeFileSync('E:/project/club-penguin-browser/client/public/assets/penguin-body.png', png);
console.log('OK', src.w + 'x' + src.h, png.length, 'bytes');
