import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const toData = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const res = await p.evaluate(async ([sa, sb]) => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [a, c] = await Promise.all([load(sa), load(sb)]);
  const stats = (img, fx0, fy0, fx1, fy1) => {
    const w = img.width, h = img.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const x0 = Math.floor(w * fx0), y0 = Math.floor(h * fy0), x1 = Math.floor(w * fx1), y1 = Math.floor(h * fy1);
    const d = cx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let n = 0, orange = 0, yellow = 0, dark = 0, bright = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      n++;
      if (R > 180 && G > 60 && G < 170 && B < 90) orange++;       // laranja/red-sign
      if (R > 170 && G > 140 && B < 100) yellow++;                // amarelo/estrelas
      if (R + G + B < 150) dark++;
      if (R + G + B > 500) bright++;
    }
    return { orangePct: +(100 * orange / n).toFixed(1), yellowPct: +(100 * yellow / n).toFixed(1), darkPct: +(100 * dark / n).toFixed(1), brightPct: +(100 * bright / n).toFixed(1) };
  };
  return {
    // regiao do letreiro DISCO: acima da entrada do nightclub
    discoFull2: stats(a, 0.40, 0.24, 0.64, 0.46),
    discoSegs: stats(c, 0.40, 0.24, 0.64, 0.46),
    // regiao do NIGHTCLUB roof sign (controle - deve ser igual)
    roofFull2: stats(a, 0.38, 0.10, 0.66, 0.24),
    roofSegs: stats(c, 0.38, 0.10, 0.66, 0.24),
  };
}, [toData('shots/bg-full2.png'), toData('shots/bg-segs.png')]);
console.log(JSON.stringify(res, null, 1));
await b.close();
