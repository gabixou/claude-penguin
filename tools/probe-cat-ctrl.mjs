import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(500);
const st = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  return { page: c.page, controls: c.controls.map(x => ({ path: x.path, label: x.label, bounds: x.bounds.map(v=>Math.round(v)) })) };
});
console.log(JSON.stringify(st, null, 1));
// amostra de pixels do canvas do catalogo (regiao inferior do livro)
const px = await p.evaluate(() => {
  const cv = window.__penguin.scene.catalogue.canvas;
  const ctx = cv.getContext('2d');
  const out = {};
  for (const [k, x, y] of [['bottom-mid', 380*2, 430*2], ['bottom-right', 700*2, 440*2], ['cover-center', 380*2, 240*2], ['below-book', 380*2, 470*2]]) {
    const d = ctx.getImageData(x, y, 1, 1).data;
    out[k] = [d[0], d[1], d[2], d[3]];
  }
  return out;
});
console.log('pixels:', JSON.stringify(px));
await b.close();
