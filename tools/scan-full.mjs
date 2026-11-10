import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/tools/shot2.png'));
const px = (x, y) => { const i = (y * img.w + x) * img.ch; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };

// 1) sombra: regiao escurecida abaixo do pinguim (x370-440, y360-390) vs fundo
console.log('--- shadow scan (media de brilho por linha) ---');
for (let y = 358; y <= 392; y += 2) {
    let sum = 0, n = 0;
    for (let x = 375; x <= 435; x += 3) { const [r, g, b] = px(x, y); sum += r + g + b; n++; }
    console.log('y' + y, 'avg', (sum / n / 3).toFixed(0));
}
// fundo de referencia (longe do pinguim)
let ref = 0, rn = 0;
for (let y = 300; y < 340; y += 4) for (let x = 600; x < 740; x += 4) { const [r, g, b] = px(x, y); ref += r + g + b; rn++; }
console.log('bg ref avg', (ref / rn / 3).toFixed(0));

// 2) verde em toda a tela (poligonos debug?)
console.log('--- green scan ---');
let greens = [];
for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) {
    const [r, g, b] = px(x, y);
    if (g > 140 && g > r + 50 && g > b + 50) greens.push([x, y]);
}
console.log('green px(sampled):', greens.length);
if (greens.length) {
    const xs = greens.map(p => p[0]), ys = greens.map(p => p[1]);
    console.log('bbox', Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    // cluster aprox: conta por faixa de y
    const bands = {};
    for (const [, y] of greens) bands[Math.floor(y / 60) * 60] = (bands[Math.floor(y / 60) * 60] || 0) + 1;
    console.log(bands);
}

// 3) anel azul: pixels 0x00aaff-ish (azul vivo) na regiao dos pes
console.log('--- ring scan ---');
let ring = 0;
for (let y = 355; y <= 385; y++) for (let x = 370; x <= 440; x++) {
    const [r, g, b] = px(x, y);
    if (b > 200 && g > 100 && g < 200 && r < 60) ring++;
}
console.log('ringBlue px:', ring);
