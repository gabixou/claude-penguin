import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const ls = window.__penguin.scene.loadingScreen;
  return !ls || !ls.visible;
}, null, { timeout: 180000 }).catch(() => {});
await p.waitForTimeout(1000);

const open1 = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  await sc.wardrobe.open(sc.localPlayer);
  await new Promise(r => setTimeout(r, 1500));
  return { open: sc.wardrobe.isOpen, cells: sc.wardrobe.cells.length, tabs: (sc.wardrobe.tabZones || []).length };
});
console.log('open1', JSON.stringify(open1));

await p.evaluate(() => window.__penguin.scene.wardrobe.close());
await p.waitForTimeout(300);

const open2 = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  await sc.wardrobe.open(sc.localPlayer);
  await new Promise(r => setTimeout(r, 1500));
  return {
    open: sc.wardrobe.isOpen,
    cells: sc.wardrobe.cells.length,
    tabs: (sc.wardrobe.tabZones || []).length,
    gridChildren: sc.wardrobe._gridCont ? sc.wardrobe._gridCont.length : -1,
  };
});
console.log('open2', JSON.stringify(open2));

// clica na aba 'body' para testar menus
const tabTest = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const z = (sc.wardrobe.tabZones || []).find(z => z._tab === 'body');
  if (!z) return 'no zone';
  z.emit('pointerdown');
  await new Promise(r => setTimeout(r, 500));
  return { tab: sc.wardrobe.tab, cells: sc.wardrobe.cells.length };
});
console.log('tabTest', JSON.stringify(tabTest));

await p.screenshot({ path: 'tools/shots/probe-wardrobe-reopen.png' });
console.log('errors', JSON.stringify(errs));
await b.close();
