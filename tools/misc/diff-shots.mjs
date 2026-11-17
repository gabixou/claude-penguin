import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
const res = await p.evaluate(async () => {
  const load = (src) => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej;
    i.src = 'data:image/png;base64,' + src;
  });
  const fs = await fetch('file:///E:/project/club-penguin-browser/tools/shots/pcard-self.png').catch(() => null);
  return 'need-file-api';
});
// file:// nao funciona em page.evaluate; embute via readFileSync -> base64
import { readFileSync } from 'node:fs';
const a64 = readFileSync('shots/pcard-self.png').toString('base64');
const b64 = readFileSync('shots/pcard-hint-card.png').toString('base64');
const out = await p.evaluate(async ([a64, b64]) => {
  const load = (b64) => new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej;
    i.src = 'data:image/png;base64,' + b64;
  });
  const [ia, ib] = await Promise.all([load(a64), load(b64)]);
  const W = Math.min(ia.width, ib.width), H = Math.min(ia.height, ib.height);
  const ca = document.createElement('canvas'); ca.width = W; ca.height = H;
  const cb = document.createElement('canvas'); cb.width = W; cb.height = H;
  const xa = ca.getContext('2d'), xb = cb.getContext('2d');
  xa.drawImage(ia, 0, 0); xb.drawImage(ib, 0, 0);
  const da = xa.getImageData(0, 0, W, H).data, db = xb.getImageData(0, 0, W, H).data;
  // regiao do card: centro da tela (canvas 1266x800 aprox -> card ~ centro)
  let diff = 0, tot = 0;
  const cell = 20, grid = {};
  for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
    let d = 0, n = 0;
    for (let yy = y; yy < Math.min(y + cell, H); yy += 4)
      for (let xx = x; xx < Math.min(x + cell, W); xx += 4) {
        const i = (yy * W + xx) * 4;
        const delta = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        d += delta; n++;
      }
    const avg = d / n;
    const k = `${Math.floor(x / 100)},${Math.floor(y / 100)}`;
    grid[k] = (grid[k] || 0) + avg;
    diff += avg > 30 ? 1 : 0; tot++;
  }
  const hot = Object.entries(grid).sort((a, b2) => b2[1] - a[1]).slice(0, 12);
  return { W, H, changedCells: diff, totalCells: tot, hot };
}, [a64, b64]);
console.log(JSON.stringify(out, null, 1));
await b.close();
