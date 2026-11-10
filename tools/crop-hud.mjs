// Extrai icones/botoes reais do HUD EXAMPLE.png (screenshot do gopenguin.lol)
// para client/public/assets/hud/ — pixel-perfect, sem redesenho.
import { decodePNG, encodePNG } from './png.mjs';
import fs from 'node:fs';
import path from 'node:path';

const img = decodePNG(fs.readFileSync('E:/project/club-penguin-browser/tools/shots/hud-example.png'));
const ch = img.data.length === img.w * img.h * 3 ? 3 : 4;
const px = (x, y) => { const i = (y * img.w + x) * ch; return [img.data[i], img.data[i + 1], img.data[i + 2], ch === 4 ? img.data[i + 3] : 255]; };

const OUT = 'E:/project/club-penguin-browser/client/public/assets/hud';
fs.mkdirSync(OUT, { recursive: true });

function crop(name, cx, cy, size, outSize = size, circle = false) {
    const x0 = Math.round(cx - size / 2), y0 = Math.round(cy - size / 2);
    const R = size * 0.47; // raio do botao circular
    const rgba = Buffer.alloc(outSize * outSize * 4);
    for (let y = 0; y < outSize; y++) for (let x = 0; x < outSize; x++) {
        const sx = x0 + Math.floor(x * size / outSize), sy = y0 + Math.floor(y * size / outSize);
        const [r, g, b, a] = px(sx, sy);
        const i = (y * outSize + x) * 4;
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
        if (circle) {
            // mascara circular com feather de ~4% do raio
            const dx = (x - outSize / 2) * (size / outSize), dy = (y - outSize / 2) * (size / outSize);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > R) rgba[i + 3] = 0;
            else if (d > R - size * 0.05) rgba[i + 3] = Math.round(255 * (R - d) / (size * 0.05));
        }
    }
    fs.writeFileSync(path.join(OUT, name), encodePNG(outSize, outSize, 4, rgba));
    console.log('crop', name, `${size}px @${cx},${cy} -> ${outSize}`);
}

// botoes do dock (centros detectados no screenshot 1781x1164)
const btnY = 1092;
const centers = [136, 196, 288, 364, 444, 1232, 1324, 1396, 1480, 1556, 1644];
centers.forEach((cx, i) => crop(`btn-${i + 1}.png`, cx, btnY, 92, 46, true));

// icone MAP dobrado (canto inferior esquerdo, acima do dock)
crop('map-icon.png', 105, 965, 150, 60);
// envelope correio (topo esquerdo)
crop('mail-icon.png', 105, 105, 160, 64);
