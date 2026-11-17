import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const toData = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const res = await p.evaluate(async ([ta, tb, tc]) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [a, c, d] = await Promise.all([load(ta), load(tb), load(tc)]);
  const stats = (img) => {
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const dd = cx.getImageData(0, 0, img.width, img.height).data;
    let op = 0, orange = 0, yellow = 0;
    for (let i = 0; i < dd.length; i += 4) {
      if (dd[i + 3] > 40) {
        op++;
        const R = dd[i], G = dd[i + 1], B = dd[i + 2];
        if (R > 180 && G > 60 && G < 170 && B < 90) orange++;
        if (R > 170 && G > 140 && B < 100) yellow++;
      }
    }
    return { op, orange, yellow };
  };
  return { block: stats(a), triggers: stats(c), foreground: stats(d) };
}, [toData('shots/top-block_mc.png'), toData('shots/top-triggers_mc.png'), toData('shots/top-foreground_mc.png')]);
console.log(JSON.stringify(res));
await b.close();
