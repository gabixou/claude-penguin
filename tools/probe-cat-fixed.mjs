import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, args: ['--window-size=1520,960'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=town', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
// pets catalogo (pior caso — puffles amplificados)
await p.evaluate(() => window.__penguin.scene.catalogue?.open?.('pets'));
await p.waitForTimeout(6000);
const st = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  return c?.movie ? { canvas: [c.canvas?.width, c.canvas?.height], ss: c._renderSs, flat: c.movie.artFlatScale } : null;
});
console.log('pets:', JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/cat-pets-NEW-p1.png' });
// clothing p4 (fantasias — sprites detalhados)
await p.evaluate(() => window.__penguin.scene.catalogue?.close?.());
await p.waitForTimeout(400);
await p.evaluate(() => window.__penguin.scene.catalogue?.open?.('clothing'));
await p.waitForTimeout(5000);
await p.evaluate(() => { const c = window.__penguin.scene.catalogue; c.movie.goto('book', 4); c._show(); });
await p.waitForTimeout(2500);
await p.screenshot({ path: 'tools/shots/cat-clothing-NEW-p4.png' });
console.log('done');
await b.close();
