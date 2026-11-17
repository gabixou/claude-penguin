// crop-img.mjs <in.png> <out.png> <x> <y> <w> <h> — recorta regiao
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const [,, inp, out, X, Y, W, H] = process.argv;
const b64 = fs.readFileSync(inp).toString('base64');
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('about:blank');
const res = await p.evaluate(async ([src, x, y, w, h]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
}, ['data:image/png;base64,' + b64, +X, +Y, +W, +H]);
await b.close();
fs.writeFileSync(out, Buffer.from(res.split(',')[1], 'base64'));
console.log('crop ->', out);
