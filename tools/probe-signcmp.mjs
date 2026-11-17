import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const toData = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
// regiao do letreiro: clone screen ~x480-830,y80-210 ; ref e 1400x900 -> escala diferente, uso fracao
const res = await p.evaluate(async ([sa, sb]) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [a, c] = await Promise.all([load(sa), load(sb)]);
  const stats = (img, fx0, fy0, fx1, fy1) => {
    const w = img.width, h = img.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const x0 = Math.floor(w * fx0), y0 = Math.floor(h * fy0), x1 = Math.floor(w * fx1), y1 = Math.floor(h * fy1);
    const d = cx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let n = 0, r = 0, g = 0, bl = 0, bright = 0, yellow = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      r += R; g += G; bl += B; n++;
      if (R + G + B > 450) bright++;
      if (R > 180 && G > 140 && B < 110) yellow++;
    }
    return { avg: [Math.round(r / n), Math.round(g / n), Math.round(bl / n)], brightPct: +(100 * bright / n).toFixed(1), yellowPct: +(100 * yellow / n).toFixed(1) };
  };
  // regiao do letreiro como fracao da tela (clone 1280x800, ref 1400x900)
  // sign screen bounds ~x488-822,y84-202 em 1280x800 -> fx .38-.65, fy .10-.26
  return {
    cloneSign: stats(a, 0.36, 0.08, 0.68, 0.28),
    refSign: stats(c, 0.36, 0.08, 0.68, 0.28),
    cloneFull: stats(a, 0, 0, 1, 1),
    refFull: stats(c, 0, 0, 1, 1),
  };
}, [toData('shots/town-now.png'), toData('shots/gp-town.png')]);
console.log(JSON.stringify(res, null, 1));
await b.close();
