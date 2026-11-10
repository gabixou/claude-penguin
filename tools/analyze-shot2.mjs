import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/tools/shot2.png'));
const px = (x, y) => { const i = (y * img.w + x) * img.ch; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
// amostra grade 8x6 na tela toda
for (let y = 20; y < img.h; y += Math.floor(img.h / 8)) {
    let row = '';
    for (let x = 20; x < img.w; x += Math.floor(img.w / 8)) {
        const [r, g, b] = px(x, y);
        row += ' ' + String(r).padStart(3) + ',' + String(g).padStart(3) + ',' + String(b).padStart(3);
    }
    console.log('y' + String(y).padStart(3) + ':' + row);
}
// regiao do pinguim (~400,346)
console.log('--- penguin region ---');
for (let y = 300; y <= 400; y += 10) {
    let row = '';
    for (let x = 340; x <= 480; x += 10) { const [r, g, b] = px(x, y); row += ' ' + r + ',' + g + ',' + b; }
    console.log('y' + y + ':' + row);
}
