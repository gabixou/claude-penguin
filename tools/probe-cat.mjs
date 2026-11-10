import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.catalogue.open('clothing'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(1500);
const dump = async (tag) => {
  const r = await p.evaluate(() => {
    const c = window.__penguin.scene.catalogue;
    return { page: c.movie.currentFrame('book'), controls: c.controls.map(x => x.label).slice(0, 15), n: c.controls.length };
  });
  console.log(tag, JSON.stringify(r));
};
await dump('p1');
// clica no botao Next page (bounds -> centro)
const next = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  const b = c.controls.find(x => /next/i.test(x.label));
  if (!b) return null;
  const [x0, y0, x1, y1] = b.bounds;
  return [(x0 + x1) / 2, (y0 + y1) / 2];
});
if (next) { await p.evaluate(([x,y]) => window.__penguin.scene.catalogue.clickAt(x,y), next); await p.waitForTimeout(1200); }
await dump('p2');
await b.close();
