import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/tools/shot1.png'));
console.log('shot', img.w, img.h);
const px = (x, y) => { const i = (y * img.w + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]; };
let bodyBlue = 0;
const hits = [];
for (let y = 250; y < 430; y++) for (let x = 300; x < 520; x++) {
    const [r, g, b] = px(x, y);
    if (b > 200 && g > 80 && g < 200 && r < 80) { bodyBlue++; hits.push([x, y]); }
}
console.log('bodyBlue~', bodyBlue);
if (hits.length) {
    const xs = hits.map(h => h[0]), ys = hits.map(h => h[1]);
    console.log('blue bbox x', Math.min(...xs), Math.max(...xs), 'y', Math.min(...ys), Math.max(...ys));
}
for (let y = 300; y <= 400; y += 20) {
    let row = '';
    for (let x = 340; x <= 480; x += 20) { const [r, g, b] = px(x, y); row += ' ' + r + ',' + g + ',' + b; }
    console.log('y' + y + ':' + row);
}
