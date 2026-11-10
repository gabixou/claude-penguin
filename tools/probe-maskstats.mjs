import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'rink';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.addInitScript(() => { window.__movieDebug = true; });
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
let ok = false;
for (let i = 0; i < 300; i++) {
  await p.waitForTimeout(3000);
  ok = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    const layers = s && s.movieLayers || [];
    return !!(s && s.movie && layers.length && layers.every(l => !l._busy));
  }).catch(() => false);
  if (ok) break;
}
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
  const st = window.__maskStats || [];
  const bad = st.filter(x => x.prePx > 500 && x.keptPx < x.prePx * 0.05);
  const emptyMask = st.filter(x => x.maskPx < 50 && x.prePx > 200);
  return { total: st.length, bad: bad.length, emptyMask: emptyMask.length,
    badSample: bad.slice(0, 10), emptySample: emptyMask.slice(0, 10) };
});
console.log(room, JSON.stringify(r, null, 1));
await b.close();
