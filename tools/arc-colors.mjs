// arc-colors.mjs <day.png> <night.png> — acha cores do ARCO no dia
// (pixels claro-azulados na regiao do piso) e mostra o que viraram
// no pack noturno via map2-dojoext.json
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const map = JSON.parse(fs.readFileSync('E:/project/cp-halloween-swfs/map2-dojoext.json', 'utf8'));
const b64 = fs.readFileSync(process.argv[2]).toString('base64');
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('about:blank');
const hits = await p.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const hits = {};
    // regiao do piso: metade inferior do crop
    const y0 = Math.floor(c.height * 0.4);
    for (let y = y0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            const r = d[0], g = d[1], bl = d[2];
            // cinza-azulado claro: b>=r, lum alta
            if (bl >= r - 5 && bl >= g - 15) {
                const l = (Math.max(r, g, bl) + Math.min(r, g, bl)) / 2;
                if (l > 170) {
                    const h = '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
                    hits[h] = (hits[h] || 0) + 1;
                }
            }
        }
    }
    return Object.entries(hits).sort((a, b2) => b2[1] - a[1]).slice(0, 30);
}, 'data:image/png;base64,' + b64);
await b.close();
for (const [h, n] of hits) console.log(h, 'x' + n, '->', map[h] || '(fora do mapa)');
