import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const fails = [];
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') fails.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
// forca render de TODAS as abas/paginas para aquecer cache de icones
const res = await p.evaluate(async () => {
  const w = window.__penguin.scene.wardrobe;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (const t of w.cats) {
    if (t === 'color') continue;
    const items = w._filteredItems.call({ ...w, tab: t, search: '', ownedIds: w.ownedIds, items: w.items });
    const pages = Math.ceil(items.length / 12);
    for (let pg = 0; pg < pages; pg++) {
      w.tab = t; w.page = pg; await w._renderGrid();
      await sleep(400);
    }
  }
  await sleep(8000);
  // ids cujo icone falhou (null no cache)
  const failed = [...w._iconTex.entries()].filter(([k, v]) => v === null).map(([k]) => k);
  return { failed, totalCached: w._iconTex.size };
});
console.log(JSON.stringify(res));
console.log('fails:', fails.filter(f => f.includes('icons/')).slice(0, 30));
await b.close();
