import { chromium } from 'playwright-core';
import fs from 'fs';
const toData = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const res = await p.evaluate(async ([sa, sc]) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [a, c] = await Promise.all([load(sa), load(sc)]);
  const w = Math.min(a.width, c.width), h = Math.min(a.height, c.height);
  const ca = document.createElement('canvas'); ca.width = w; ca.height = h;
  const cx = document.createElement('canvas'); cx.width = w; cx.height = h;
  const xa = ca.getContext('2d'), xc = cx.getContext('2d');
  xa.drawImage(a, 0, 0); xc.drawImage(c, 0, 0);
  const da = xa.getImageData(0, 0, w, h).data, dc = xc.getImageData(0, 0, w, h).data;
  const grid = Array.from({ length: 16 }, () => Array(16).fill(0));
  let total = 0;
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
    const i = (y * w + x) * 4;
    const diff = Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]);
    if (diff > 30) { grid[(y / h * 16) | 0][(x / w * 16) | 0]++; total++; }
  }
  return { w, h, total, grid };
}, [toData('shots/dance-withdyn.png'), toData('shots/dance-nodyn.png')]);
console.log('size', res.w, 'x', res.h, 'diffSamples:', res.total);
for (let r = 0; r < 16; r++) console.log(res.grid[r].map(v => String(v).padStart(4)).join(''));
await b.close();
