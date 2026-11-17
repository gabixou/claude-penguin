// bright-map.mjs <png> — mapa de calor de pixels quase-brancos na metade inferior
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b64 = fs.readFileSync(process.argv[2]).toString('base64');
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('about:blank');
const grid = await p.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const GW = 16, GH = 8;
    const g = Array.from({ length: GH }, () => Array(GW).fill(0));
    const cw = Math.floor(c.width / GW), ch = Math.floor(c.height / GH);
    const y0 = Math.floor(c.height * 0.5);
    for (let y = y0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            const l = (Math.max(d[0], d[1], d[2]) + Math.min(d[0], d[1], d[2])) / 2;
            if (l > 190) g[Math.floor(y / ch)][Math.floor(x / cw)]++;
        }
    }
    return { w: c.width, h: c.height, g };
}, 'data:image/png;base64,' + b64);
await b.close();
console.log('size', grid.w, 'x', grid.h);
for (const row of grid.g) console.log(row.map((v) => String(v).padStart(4)).join(''));
