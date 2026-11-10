import { decodePNG } from './png.mjs';
import fs from 'node:fs';
const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/tools/shot2.png'));
const px = (x, y) => { const i = (y * img.w + x) * img.ch; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
// mapa ASCII da regiao do pinguim: x355-455, y315-395
for (let y = 315; y <= 395; y += 2) {
    let row = '';
    for (let x = 355; x <= 455; x += 2) {
        const [r, g, b] = px(x, y);
        // fundo claro ~224,226,241 = espaco
        const bg = Math.abs(r - 224) < 12 && Math.abs(g - 226) < 12 && Math.abs(b - 241) < 14;
        let c;
        if (bg) c = ' ';
        else if (b > 180 && g > 70 && g < 190 && r < 90) c = 'B';      // azul body tint
        else if (r > 240 && g > 240 && b > 240) c = 'W';              // branco
        else if (r < 60 && g < 60 && b < 60) c = 'K';                 // quase preto
        else if (g > r + 30 && g > b + 30) c = 'G';                   // verde
        else if (r > 150 && g < 120 && b < 120) c = 'R';              // vermelho/laranja
        else c = '.';
        row += c;
    }
    console.log(String(y).padStart(3) + '|' + row);
}
