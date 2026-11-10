import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
const warns = [];
p.on('console', m => { if (m.type() === 'warning') warns.push(m.text().slice(0, 140)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
// espera icones da pagina 0
await p.waitForTimeout(4000);
// para cada aba, renderiza e espera icones, conta celulas sem imagem
const res = await p.evaluate(async () => {
  const w = window.__penguin.scene.wardrobe;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const report = {};
  for (const t of w.cats) {
    if (t === 'color') continue;
    w.tab = t; w.page = 0; w._renderGrid();
    await sleep(2500); // icones async
    const cells = w.cells;
    let withImg = 0, noImg = [];
    for (const c of cells) {
      const img = c.list.find(o => o.type === 'Image');
      if (img) withImg++; else noImg.push(c);
    }
    // total de itens da aba
    const total = w._filteredItems().length;
    report[t] = { cells: cells.length, withImg, noImg: noImg.length, total };
  }
  return report;
});
console.log(JSON.stringify(res, null, 1));
console.log('warnings:', warns.slice(0, 10));
await b.close();
