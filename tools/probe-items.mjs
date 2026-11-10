import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
await p.waitForTimeout(1500);
const st = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  const perTab = {};
  for (const t of w.cats) { w.tab = t; w.page = 0; perTab[t] = w._filteredItems().length; }
  w.tab = 'all'; w.page = 0; w._renderGrid();
  return { items: w.items.length, perTab, cells: w.cells.length };
});
console.log(JSON.stringify(st));
// equipa um item recem-coberto (1187) direto no pinguim e espera render
const eq = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const p = sc.localPlayer;
  p.equip('head', 1187);
  await new Promise(r => setTimeout(r, 2500));
  return { outfit: p.gpaOutfit, hasItem: !!sc.penguinArt?.items?.get?.('head') };
});
console.log('equip 1187:', JSON.stringify(eq));
await p.screenshot({ path: 'shots/equip-1187.png' });
await b.close();
