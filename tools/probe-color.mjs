import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
const r = await p.evaluate(async () => {
  const w = window.__penguin.scene.wardrobe;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  w.tab = 'color'; w.page = 0; await w._renderGrid();
  await sleep(4000);
  const cells = w.cells.map(c => ({ id: c.itemId, hasImg: !!c.list.find(o => o.type === 'Image') }));
  const before = w.penguin.colorItemId;
  // equipa a cor da celula 2 via _pickColor
  const c2 = w._ownedColors()[1];
  w._pickColor(c2);
  return { cells, before, after: w.penguin.colorItemId, picked: c2.id };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/wardrobe-colors.png' });
await b.close();
