// analisa regiao: conta pixels claros/quentes (neon) e salva crop
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [,, fa, x0, y0, x1, y1, out] = process.argv;
const b64 = fs.readFileSync(fa).toString('base64');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
const r = await p.evaluate(async ([s, X0, Y0, X1, Y1]) => {
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
  const w = X1 - X0, h = Y1 - Y0;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, X0, Y0, w, h, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let bright = 0, warm = 0, white = 0;
  const colors = {};
  for (let i = 0; i < d.length; i += 4) {
    const R = d[i], G = d[i + 1], B = d[i + 2];
    if (R + G + B > 600) bright++;
    if (R > 180 && G > 120 && B < 120) warm++;
    if (R > 220 && G > 220 && B > 220) white++;
    const k = (R >> 4) + ',' + (G >> 4) + ',' + (B >> 4);
    colors[k] = (colors[k] || 0) + 1;
  }
  const top = Object.entries(colors).sort((a, b2) => b2[1] - a[1]).slice(0, 8);
  return { bright, warm, white, total: w * h, top, crop: c.toDataURL('image/png') };
}, [b64, +x0, +y0, +x1, +y1]);
if (out) fs.writeFileSync(out, Buffer.from(r.crop.split(',')[1], 'base64'));
console.log(JSON.stringify({ bright: r.bright, warm: r.warm, white: r.white, total: r.total, top: r.top }));
await b.close();
