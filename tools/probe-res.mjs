import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(45000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const res = performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/assets/'))
    .map(e => ({ u: e.name.split('/assets/')[1], d: Math.round(e.duration), s: e.transferSize }));
  return { movie: !!s.movie, fail: !!s.roomFailText,
           movieReqs: res.filter(x => x.u.startsWith('movies/town')),
           other404ish: res.length };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
