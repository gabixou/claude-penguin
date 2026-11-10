import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('console', m => { const t = m.text(); if (t.includes('movie') || t.includes('Error') || t.includes('error')) console.log('[' + m.type() + ']', t.slice(0, 250)); });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=mine', { waitUntil: 'domcontentloaded' });
let st = null;
for (let i = 0; i < 80; i++) {
  await p.waitForTimeout(2500);
  st = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    if (!s || !s.movie) return { movie: false };
    return {
      movie: true,
      busy: (s.movieLayers || []).map(l => !!l._busy),
      imgCache: s.movie ? s.movie._imgCache.size : 0,
      files: s.movie ? s.movie.files.size : 0,
    };
  }).catch(() => null);
  if (st && st.movie && st.busy && st.busy.every(x => !x)) break;
}
console.log(JSON.stringify(st));
await b.waitForTimeout(5000);
const st2 = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { busy: (s.movieLayers || []).map(l => !!l._busy) };
});
console.log('later', JSON.stringify(st2));
await b.close();
