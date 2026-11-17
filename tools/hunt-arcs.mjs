// hunt-arcs.mjs <png> — acha clusters de pixels CLAROS na regiao do
// piso/puffles (metade inferior) e reporta cor media de cada cluster
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b64 = fs.readFileSync(process.argv[2]).toString('base64');
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('about:blank');
const res = await p.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    // regiao do piso/puffles: metade inferior
    const y0 = Math.floor(c.height * 0.55);
    const cells = {};
    for (let y = y0; y < c.height; y += 2) {
        for (let x = 0; x < c.width; x += 2) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            const r = d[0], g = d[1], bl = d[2];
            const l = (Math.max(r, g, bl) + Math.min(r, g, bl)) / 2;
            if (l > 110) { // pixels claros no piso
                const k = Math.floor(x / 60) + ',' + Math.floor(y / 60);
                (cells[k] = cells[k] || []).push([r, g, bl]);
            }
        }
    }
    const out = [];
    for (const [k, px] of Object.entries(cells)) {
        if (px.length < 15) continue;
        const avg = [0, 1, 2].map((i) => Math.round(px.reduce((s, p) => s + p[i], 0) / px.length));
        out.push({ cell: k, n: px.length, rgb: avg });
    }
    out.sort((a, b2) => b2.n - a.n);
    return out.slice(0, 20);
}, 'data:image/png;base64,' + b64);
await b.close();
for (const r of res) {
    const h = '#' + r.rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
    console.log(r.cell, 'n=' + r.n, h);
}
