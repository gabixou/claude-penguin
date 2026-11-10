import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
for (const f of ['shots/gp-catalogue-cover.png', 'shots/cover-check.png']) {
  const b64 = readFileSync(f).toString('base64');
  const res = await p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const W = img.width, H = img.height;
    const stats = (x0, y0, w, h) => {
      const d = x.getImageData(x0, y0, w, h).data; let n = 0, col = 0, dark = 0;
      for (let i = 0; i < d.length; i += 40) { const a = d[i + 3]; if (a > 100) { n++; if (!(d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) { col++; if (d[i] < 100 && d[i + 1] < 100 && d[i + 2] < 100) dark++; } } }
      return { n, colPct: Math.round(100 * col / n), darkPct: Math.round(100 * dark / n) };
    };
    return { W, H,
      left: stats(Math.floor(W * .30), Math.floor(H * .22), Math.floor(W * .20), Math.floor(H * .55)),
      right: stats(Math.floor(W * .52), Math.floor(H * .22), Math.floor(W * .18), Math.floor(H * .55)) };
  }, b64);
  console.log(f, JSON.stringify(res));
}
await b.close();
