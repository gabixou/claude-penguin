import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'town';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const t0 = Date.now();
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
let last = '';
for (let i = 0; i < 300; i++) {
  const st = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    if (!s || !s.movie) return { movie: false };
    const layers = s.movieLayers || [];
    return { movie: true, n: layers.length, busy: layers.filter(l => l._busy).length,
      ss: s._ss };
  }).catch(() => null);
  const line = JSON.stringify(st);
  if (line !== last) { console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', line); last = line; }
  if (st && st.movie && st.n > 0 && st.busy === 0) break;
  await p.waitForTimeout(1000);
}
console.log('total', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await b.close();
