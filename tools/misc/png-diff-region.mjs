// diff restrito a uma regiao (coords de tela) de dois PNGs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [,, fa, fb, x0, y0, x1, y1] = process.argv;
const b64a = fs.readFileSync(fa).toString('base64');
const b64b = fs.readFileSync(fb).toString('base64');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
const r = await p.evaluate(async ([a, bb, X0, Y0, X1, Y1]) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a), load(bb)]);
  const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
  const ca = document.createElement('canvas'); ca.width = w; ca.height = h;
  const cb = document.createElement('canvas'); cb.width = w; cb.height = h;
  const xa = ca.getContext('2d'), xb = cb.getContext('2d');
  xa.drawImage(ia, 0, 0); xb.drawImage(ib, 0, 0);
  const da = xa.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data;
  const db = xb.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data;
  const W = X1 - X0;
  let n = 0;
  const grid = {};
  for (let i = 0; i < da.length; i += 4) {
    const px = (i / 4) % W, py = Math.floor(i / 4 / W);
    const d = Math.abs(da[i] - db[i]) + Math.abs(da[i+1] - db[i+1]) + Math.abs(da[i+2] - db[i+2]);
    if (d > 30) { n++; const k = Math.floor((X0 + px) / 20) + ',' + Math.floor((Y0 + py) / 20); grid[k] = (grid[k] || 0) + 1; }
  }
  return { n, top: Object.entries(grid).sort((a, b2) => b2[1] - a[1]).slice(0, 10) };
}, [b64a, b64b, +x0, +y0, +x1, +y1]);
console.log(JSON.stringify(r));
await b.close();
