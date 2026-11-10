import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(async () => {
  const pg = window.__penguin, v = pg.view;
  const out = {};
  // desenha cada item isolado nos frames 9 (walk) e 26 (dance) em canvas proprio, scale=4
  for (const [slot, clip] of v.items) {
    for (const fr of [9, 26]) {
      const cv = document.createElement('canvas');
      cv.width = 400; cv.height = 400;
      const cx = cv.getContext('2d');
      cx.setTransform(4, 0, 0, 4, 200, 200);
      await clip.draw(cx, fr, 4);
      const d = cx.getImageData(0, 0, 400, 400).data;
      // energia de gradiente
      let g = 0, n = 0;
      const lum = (x, y) => { const i = (y * 400 + x) * 4; return d[i] + d[i+1] + d[i+2]; };
      for (let y = 1; y < 399; y++) for (let x = 1; x < 399; x++) {
        const l = lum(x, y);
        if (l < 720) { // pixel nao-branco
          g += Math.abs(l - lum(x-1, y)) + Math.abs(l - lum(x, y-1)); n++;
        }
      }
      out[`${slot}_f${fr}`] = { energy: +(g / Math.max(1, n)).toFixed(1), px: n };
    }
  }
  // tambem o art base
  for (const fr of [9, 26]) {
    const cv = document.createElement('canvas');
    cv.width = 400; cv.height = 400;
    const cx = cv.getContext('2d');
    cx.setTransform(4, 0, 0, 4, 200, 200);
    await v.art.draw(cx, fr, 4);
    const d = cx.getImageData(0, 0, 400, 400).data;
    let g = 0, n = 0;
    const lum = (x, y) => { const i = (y * 400 + x) * 4; return d[i] + d[i+1] + d[i+2]; };
    for (let y = 1; y < 399; y++) for (let x = 1; x < 399; x++) {
      const l = lum(x, y);
      if (l < 720) { g += Math.abs(l - lum(x-1, y)) + Math.abs(l - lum(x, y-1)); n++; }
    }
    out[`art_f${fr}`] = { energy: +(g / Math.max(1, n)).toFixed(1), px: n };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
