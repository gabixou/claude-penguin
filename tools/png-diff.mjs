// diff de PNGs no browser (canvas) — uso: node png-diff.mjs a.png b.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [,, fa, fb] = process.argv;
const b64a = fs.readFileSync(fa).toString('base64');
const b64b = fs.readFileSync(fb).toString('base64');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
const r = await p.evaluate(async ([a, bb]) => {
  const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a), load(bb)]);
  const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
  const ca = document.createElement('canvas'); ca.width = w; ca.height = h;
  const cb = document.createElement('canvas'); cb.width = w; cb.height = h;
  const xa = ca.getContext('2d'), xb = cb.getContext('2d');
  xa.drawImage(ia, 0, 0); xb.drawImage(ib, 0, 0);
  const da = xa.getImageData(0, 0, w, h).data, db = xb.getImageData(0, 0, w, h).data;
  let n = 0, minx = w, miny = h, maxx = 0, maxy = 0;
  const grid = {};
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 4;
    const d = Math.abs(da[i] - db[i]) + Math.abs(da[i+1] - db[i+1]) + Math.abs(da[i+2] - db[i+2]);
    if (d > 30) {
      n++;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      const k = Math.floor(x / 40) + ',' + Math.floor(y / 40);
      grid[k] = (grid[k] || 0) + 1;
    }
  }
  const top = Object.entries(grid).sort((a, b2) => b2[1] - a[1]).slice(0, 8);
  return { n: n * 4, bbox: [minx, miny, maxx, maxy], size: [w, h], top };
}, [b64a, b64b]);
console.log(JSON.stringify(r, null, 1));
await b.close();
