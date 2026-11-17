import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.changeRoom('shop', 500, 280));
await p.waitForFunction(() => { const s = window.__penguin.scene; return s.currentRoom === 'shop' && s._movieReady === true; }, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => (window.__penguin.scene.catalogue?._pageCache?.size || 0) > 0, null, { timeout: 120000 });
// instrumenta artCanvas: registra escalas pedidas e se eram cache hit
await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  const m = c.movie;
  window.__scales = {};
  window.__misses = 0;
  const orig = m.artCanvas.bind(m);
  m.artCanvas = (file, ch, scale, bg) => {
    const had = m._artCache.has(`${file}|${+scale.toFixed(3)}`);
    if (!had) window.__misses++;
    const k = +scale.toFixed(2);
    window.__scales[k] = (window.__scales[k] || 0) + 1;
    return orig(file, ch, scale, bg);
  };
});
// vai direto para p17 e mede
const t = Date.now();
await p.evaluate(async () => {
  const c = window.__penguin.scene.catalogue;
  c.movie.goto('book', 17);
  await c._show();
});
console.log('p17 _show levou', ((Date.now() - t) / 1000).toFixed(2) + 's');
console.log(JSON.stringify(await p.evaluate(() => ({ scales: window.__scales, misses: window.__misses }))));
await b.close();
