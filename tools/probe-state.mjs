import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { movie: !!s.movie, fail: !!s.roomFailText, timer: !!s.movieTimer,
           layers: s.movieLayers ? s.movieLayers.length : null,
           camBg: s.cameras.main.backgroundColor.color };
});
console.log(JSON.stringify(r));
await b.close();
