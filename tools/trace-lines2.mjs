// trace-lines2.mjs <png> — mapa de calor das areas lavanda-claras
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
    const cells = {};
    const y0 = Math.floor(c.height * 0.4);
    for (let y = y0; y < c.height; y += 2) {
        for (let x = 0; x < c.width; x += 2) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            const r = d[0], g = d[1], bl = d[2];
            const l = (Math.max(r, g, bl) + Math.min(r, g, bl)) / 2;
            if (l > 150 && bl >= r - 15) {
                const k = Math.floor(x / 80) + ',' + Math.floor(y / 80);
                cells[k] = (cells[k] || 0) + 1;
            }
        }
    }
    return cells;
}, 'data:image/png;base64,' + b64);
await b.close();
const rows = {};
for (const [k, v] of Object.entries(grid)) {
  const [cx, cy] = k.split(',').map(Number);
  (rows[cy] = rows[cy] || []).push([cx * 80, v]);
}
for (const cy of Object.keys(rows).sort((a, b) => a - b)) {
  const line = rows[cy].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([x, v]) => `x${x}:${v}`).join(' ');
  console.log(`y~${cy * 80}: ${line}`);
}
