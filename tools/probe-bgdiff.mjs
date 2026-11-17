import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const toData = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const res = await p.evaluate(async ([sa, sb]) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [a, c] = await Promise.all([load(sa), load(sb)]);
  const w = Math.min(a.width, c.width), h = Math.min(a.height, c.height);
  const ca = document.createElement('canvas'); ca.width = w; ca.height = h;
  const cx = document.createElement('canvas'); cx.width = w; cx.height = h;
  const xa = ca.getContext('2d'), xc = cx.getContext('2d');
  xa.drawImage(a, 0, 0); xc.drawImage(c, 0, 0);
  const da = xa.getImageData(0, 0, w, h).data, dc = xc.getImageData(0, 0, w, h).data;
  const GW = 24, GH = 15, grid = Array.from({ length: GH }, () => Array(GW).fill(0));
  let total = 0;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    const i = (y * w + x) * 4;
    const diff = Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]);
    if (diff > 60) { grid[Math.min(GH - 1, (y / h * GH) | 0)][Math.min(GW - 1, (x / w * GW) | 0)]++; total++; }
  }
  return { total, grid, size: [w, h] };
}, [toData('shots/bg-full2.png'), toData('shots/bg-segs.png')]);
console.log('size', res.size, 'diff', res.total);
res.grid.forEach((r, i) => console.log(String(i).padStart(2), r.map(v => String(v).padStart(4)).join('')));
await b.close();
