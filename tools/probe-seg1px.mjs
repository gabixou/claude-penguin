import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const toData = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const res = await p.evaluate(async ([sa, sb, sc2]) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [a, c, d] = await Promise.all([load(sa), load(sb), load(sc2)]);
  const stats = (img) => {
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const dd = cx.getImageData(0, 0, img.width, img.height).data;
    let n = 0, orange = 0, yellow = 0, op = 0;
    for (let i = 0; i < dd.length; i += 4) {
      if (dd[i + 3] > 40) {
        op++; n++;
        const R = dd[i], G = dd[i + 1], B = dd[i + 2];
        if (R > 180 && G > 60 && G < 170 && B < 90) orange++;
        if (R > 170 && G > 140 && B < 100) yellow++;
      }
    }
    return { size: [img.width, img.height], op, orangePct: +(100 * orange / Math.max(1, op)).toFixed(1), yellowPct: +(100 * yellow / Math.max(1, op)).toFixed(1) };
  };
  return { seg1: stats(a), seg3: stats(c), dynSign: stats(d) };
}, [toData('shots/x-seg1_d3_0005.png'), toData('shots/x-seg3_d3_0008.png'), toData('shots/x-dyn1_nightclubsign_mc.png')]);
console.log(JSON.stringify(res, null, 1));
await b.close();
