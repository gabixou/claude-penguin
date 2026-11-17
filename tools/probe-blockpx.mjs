import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const toData = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const res = await p.evaluate(async ([ta, tb]) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [a, c] = await Promise.all([load(ta), load(tb)]);
  const grid = (img) => {
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const dd = cx.getImageData(0, 0, img.width, img.height).data;
    const GW = 12, GH = 8, g = Array.from({length: GH}, () => Array(GW).fill(0));
    for (let y = 0; y < img.height; y += 8) for (let x = 0; x < img.width; x += 8) {
      const i = (y * img.width + x) * 4;
      if (dd[i + 3] > 40) g[Math.min(GH-1,(y/img.height*GH)|0)][Math.min(GW-1,(x/img.width*GW)|0)]++;
    }
    return g;
  };
  return { block: grid(a), triggers: grid(c) };
}, [toData('shots/top-block_mc.png'), toData('shots/top-triggers_mc.png')]);
console.log('BLOCK'); res.block.forEach(r => console.log(r.map(v=>String(v).padStart(4)).join('')));
console.log('TRIGGERS'); res.triggers.forEach(r => console.log(r.map(v=>String(v).padStart(4)).join('')));
await b.close();
