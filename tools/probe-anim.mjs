import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1000);
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene, m = sc.movie;
  const ph = m._playheads.size;
  // espera 500ms e ve se dirtyRoots/populacao acontece
  const before = ph;
  await new Promise(r => setTimeout(r, 600));
  const ticks = (window.__tickCount = (window.__tickCount || 0));
  return {
    room: sc.currentRoom,
    playheads: before,
    dirtyRootsSample: [...(m._dirtyRoots || [])].slice(0, 8),
    layers: sc.movieLayers.length,
  };
});
console.log(JSON.stringify(r));
// conta renders: instrumenta renderLayer
await p.evaluate(() => {
  const sc = window.__penguin.scene;
  window.__renders = 0;
  const orig = sc.movie.renderLayer.bind(sc.movie);
  sc.movie.renderLayer = (...a) => { window.__renders++; return orig(...a); };
});
await p.waitForTimeout(2000);
console.log('renders in 2s:', await p.evaluate(() => window.__renders));
await b.close();
