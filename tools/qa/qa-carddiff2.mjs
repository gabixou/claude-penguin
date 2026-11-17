import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
const files = ['v3000-pcard.png', 'pcard-self.png']; // :3000 vs :3100 verificado
const b64s = files.map(f => readFileSync('shots/' + f).toString('base64'));
const out = await p.evaluate(async ([a64, b64]) => {
  const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b64; });
  const [ia, ib] = await Promise.all([load(a64), load(b64)]);
  const sx = ia.width / 760, sy = ia.height / 480;
  const rx = Math.floor(250.5 * sx) - 10, ry = Math.floor(72.5 * sy) - 10;
  const rw = Math.floor(259 * sx) + 20, rh = Math.floor(335 * sy) + 20;
  const ca = document.createElement('canvas'); ca.width = rw; ca.height = rh;
  const cb = document.createElement('canvas'); cb.width = rw; cb.height = rh;
  ca.getContext('2d').drawImage(ia, rx, ry, rw, rh, 0, 0, rw, rh);
  cb.getContext('2d').drawImage(ib, rx, ry, rw, rh, 0, 0, rw, rh);
  const da = ca.getContext('2d').getImageData(0, 0, rw, rh).data;
  const db = cb.getContext('2d').getImageData(0, 0, rw, rh).data;
  let diff = 0, tot = 0;
  for (let i = 0; i < da.length; i += 4) {
    const dd = Math.abs(da[i]-db[i]) + Math.abs(da[i+1]-db[i+1]) + Math.abs(da[i+2]-db[i+2]) + Math.abs(da[i+3]-db[i+3]);
    tot++; if (dd > 60) diff++;
  }
  return { diffPx: diff, totPx: tot, pct: (100*diff/tot).toFixed(2),
    cropA: ca.toDataURL('image/png'), cropB: cb.toDataURL('image/png') };
}, b64s);
writeFileSync('shots/v3000-cardcrop.png', Buffer.from(out.cropA.split(',')[1], 'base64'));
writeFileSync('shots/v3100-cardcrop.png', Buffer.from(out.cropB.split(',')[1], 'base64'));
console.log(JSON.stringify({ diffPx: out.diffPx, pct: out.pct }));
await b.close();
