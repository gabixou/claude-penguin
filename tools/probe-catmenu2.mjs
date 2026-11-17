import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes?.() ?? window.__penguin.scene.playerCard?.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen || window.__penguin.scene.clothesOpen, null, { timeout: 30000 });
await p.waitForTimeout(800);
// abre o menu e clica numa opcao que fica SOBRE uma celula do grid
await p.evaluate(() => window.__penguin.scene.wardrobe._toggleCatMenu());
await p.waitForTimeout(200);
const r = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  const mz = w._catMenu.list.find(o => o._cat === 'feet');
  const b = mz.getBounds();
  const rect = window.__penguin.scene.game.canvas.getBoundingClientRect();
  return { sx: rect.left + b.centerX * rect.width / 760, sy: rect.top + b.centerY * rect.height / 480 };
});
const outfitBefore = await p.evaluate(() => JSON.stringify(window.__penguin.scene.localPlayer?.gpaOutfit || {}));
await p.mouse.click(r.sx, r.sy);
await p.waitForTimeout(400);
const after = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return { tab: w.tab, open: w.isOpen, menuVisible: w._catMenu.visible, outfit: JSON.stringify(window.__penguin.scene.localPlayer?.gpaOutfit || {}) };
});
console.log('antes:', outfitBefore);
console.log('depois:', JSON.stringify(after));
await p.screenshot({ path: 'shots/catmenu2.png' });
await b.close();
