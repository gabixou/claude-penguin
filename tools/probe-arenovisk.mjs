import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); // fresh: sem localStorage
const p = await ctx.newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
const r = await p.evaluate(() => {
  const net = window.__penguin.scene.network;
  return { user: net.username, coins: net.coins, inv: net.inventory?.length, allItems: net.playerData?.allItems };
});
console.log('cliente:', JSON.stringify(r));
// wardrobe: quantos itens na aba all?
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
await p.waitForTimeout(1500);
const w = await p.evaluate(() => {
  const wd = window.__penguin.scene.wardrobe;
  return { owned: wd.ownedIds?.size, pages: wd._totalPages(), cells: wd.cells.length };
});
console.log('wardrobe:', JSON.stringify(w));
await p.screenshot({ path: 'shots/arenovisk.png' });
await b.close();
