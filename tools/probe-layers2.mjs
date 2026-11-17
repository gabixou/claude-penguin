import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(60000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return (s.movieLayers || []).map((l, i) => {
    const c = l.canvas, ctx = c.getContext('2d');
    // sample grid for any non-transparent px
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let j = 3; j < d.length; j += 4 * 97) if (d[j] > 0) painted++;
    return { i, name: l.entry.name || ('#' + l.entry.id), w: c.width, painted };
  });
});
console.log(JSON.stringify(r, null, 1));
await b.close();
