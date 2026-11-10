import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const ls = window.__penguin.scene.loadingScreen;
  return !ls || !ls.visible;
}, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(1000);

await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  await w.open(sc.localPlayer);
  w.tab = 'head'; w.page = 0;
  await w._renderGrid();
  await new Promise(r => setTimeout(r, 800));
  window.__hits = [];
  w.cells.forEach((c, i) => c.on('pointerdown', () => window.__hits.push('cell' + i)));
  (w.tabZones || []).forEach(z => z.on('pointerdown', () => window.__hits.push('tab:' + z._tab)));
});

// move mouse real para a celula 0 e clica
await p.mouse.move(876, 250);
await p.waitForTimeout(200);
const hit = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const ptr = sc.input.activePointer;
  const res = sc.input.hitTestPointer(ptr);
  return {
    worldX: ptr.worldX, worldY: ptr.worldY,
    hits: res.map(o => o.type + ':' + (o._tab || o.texture?.key || o.name || '?')).slice(0, 10),
    n: res.length,
  };
});
console.log('hitTest', JSON.stringify(hit));
await p.mouse.click(876, 250);
await p.waitForTimeout(400);
console.log('events', JSON.stringify(await p.evaluate(() => window.__hits)));
console.log('head', await p.evaluate(() => window.__penguin.gpaOutfit?.head));
await b.close();
