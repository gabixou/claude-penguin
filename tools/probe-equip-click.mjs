import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const ls = window.__penguin.scene.loadingScreen;
  return !ls || !ls.visible;
}, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(1000);

// abre wardrobe via API e pega bounds da primeira celula 'body'
const cellInfo = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  await w.open(sc.localPlayer);
  w.tab = 'body'; w.page = 0;
  await w._renderGrid();
  await new Promise(r => setTimeout(r, 600));
  const cell = w.cells[0];
  const bb = cell.getBounds();
  return { x: bb.centerX, y: bb.centerY, w: bb.width, h: bb.height, n: w.cells.length };
});
console.log('cell', JSON.stringify(cellInfo));

// clique real do mouse
await p.mouse.click(cellInfo.x, cellInfo.y);
await p.waitForTimeout(5000);
const after = await p.evaluate(() => {
  const pg = window.__penguin;
  return { outfitBody: pg.gpaOutfit?.body, lookBody: pg.view.look.body, hasBody: pg.view.items.has('body') };
});
console.log('after click', JSON.stringify(after));
await p.screenshot({ path: 'tools/shots/probe-equip-click.png' });
await b.close();
