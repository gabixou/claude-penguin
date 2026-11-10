import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 120)));
// 1a carga: popula o cache IndexedDB
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 90000 });
console.log('cold load done, reloading for warm test...');
// reload = mesmo contexto = IDB quente
await p.reload({ waitUntil: 'domcontentloaded' });
let violations = 0, sawPartial = 0;
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(50);
  const st = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    if (!s) return null;
    const layers = s.movieLayers || [];
    return { loader: !!s.loadingScreen?.visible, ready: !!s._movieReady,
             vis: layers.filter(l => l.img?.visible).length, total: layers.length };
  }).catch(() => null);
  if (!st) continue;
  if (st.vis > 0 && (!st.ready || st.loader)) violations++;
  if (st.vis > 0 && st.vis < st.total) sawPartial++;
  if (st.ready && st.vis === st.total && st.total > 0) {
    console.log(`REVEALED vis=${st.vis}/${st.total} loader=${st.loader}`);
    break;
  }
}
console.log('violations:', violations, 'partial-visible samples:', sawPartial);
await b.close();
