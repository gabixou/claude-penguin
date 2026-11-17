// diff-imgs.mjs <a.png> <b.png> — reporta pixels alterados entre dois
// screenshots (onde o segundo diff muda vs o primeiro)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('about:blank');
const [a64, b64] = [fs.readFileSync(process.argv[2]).toString('base64'), fs.readFileSync(process.argv[3]).toString('base64')];
const res = await p.evaluate(async ([sa, sb]) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const ia = await load('data:image/png;base64,' + sa);
    const ib = await load('data:image/png;base64,' + sb);
    const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
    const cx = c.getContext('2d'); cx.drawImage(ia, 0, 0);
    const da = cx.getImageData(0, 0, c.width, c.height).data;
    cx.clearRect(0, 0, c.width, c.height); cx.drawImage(ib, 0, 0);
    const db = cx.getImageData(0, 0, c.width, c.height).data;
    const cells = {};
    let n = 0;
    const samples = [];
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
        const i = (y * c.width + x) * 4;
        const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        if (d > 30) {
            n++;
            const k = Math.floor(x / 80) + ',' + Math.floor(y / 80);
            cells[k] = (cells[k] || 0) + 1;
            if (samples.length < 8 && y > c.height * 0.4) samples.push([x, y]);
        }
    }
    return { n, cells, samples, w: c.width, h: c.height };
}, [a64, b64]);
await b.close();
console.log('changed px:', res.n);
const rows = {};
for (const [k, v] of Object.entries(res.cells)) { const [cx, cy] = k.split(',').map(Number); (rows[cy] = rows[cy] || []).push([cx * 80, v]); }
for (const cy of Object.keys(rows).sort((a, b2) => a - b2)) {
    console.log(`y~${cy * 80}:`, rows[cy].sort((a, b2) => b2[1] - a[1]).slice(0, 8).map(([x, v]) => `x${x}:${v}`).join(' '));
}
