import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
await p.waitForTimeout(800);
// abre o menu da pilula
await p.evaluate(() => window.__penguin.scene.wardrobe._toggleCatMenu());
await p.waitForTimeout(200);
// clica na opcao "Head" do menu (zone real)
const r = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  const mz = w._catMenu.list.find(o => o._cat === 'head');
  if (!mz) return { err: 'menu zone nao achada' };
  const b = mz.getBounds();
  const rect = window.__penguin.scene.game.canvas.getBoundingClientRect();
  return { sx: rect.left + b.centerX * rect.width / 760, sy: rect.top + b.centerY * rect.height / 480, visible: w._catMenu.visible };
});
console.log('menu:', JSON.stringify(r));
await p.mouse.click(r.sx, r.sy);
await p.waitForTimeout(400);
const after = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return { tab: w.tab, cells: w.cells.length, open: w.isOpen, menuVisible: w._catMenu.visible };
});
console.log('apos clique Head:', JSON.stringify(after));
await p.screenshot({ path: 'shots/catmenu.png' });
await b.close();
