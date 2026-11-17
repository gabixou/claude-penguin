// sample-shot.mjs <png> — imprime grade de cores RGB do screenshot
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const file = process.argv[2];
const b64 = fs.readFileSync(file).toString('base64');
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('about:blank');
const out = await p.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pts = [];
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 8; gx++) {
        const x = Math.floor((gx + 0.5) * c.width / 8);
        const y = Math.floor((gy + 0.5) * c.height / 5);
        const d = ctx.getImageData(x, y, 1, 1).data;
        pts.push(`#${[d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`);
    }
    return { w: c.width, h: c.height, pts };
}, 'data:image/png;base64,' + b64);
console.log(out.w + 'x' + out.h);
for (let y = 0; y < 5; y++) console.log(out.pts.slice(y * 8, y * 8 + 8).join(' '));
await b.close();
