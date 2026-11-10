import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(60000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const l = s.movieLayers[0]; // background_mc
  const c = l.canvas, ctx = c.getContext('2d');
  const avg = (x0, y0, w, h) => {
    const d = ctx.getImageData(x0, y0, w, h).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
    return [r/n, g/n, b/n].map(v => Math.round(v));
  };
  return {
    canvas: [c.width, c.height],
    imgVisible: l.img.visible, imgAlpha: l.img.alpha,
    depth: l.img.depth,
    sky: avg(400, 20, 300, 100),
    mid: avg(400, 300, 300, 150),
    displaySize: [l.img.displayWidth, l.img.displayHeight],
    x: l.img.x, y: l.img.y,
  };
});
console.log(JSON.stringify(r));
await b.close();
