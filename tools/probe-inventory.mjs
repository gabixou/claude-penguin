import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(6000);
const r = await p.evaluate(async () => {
  const w = window.__penguin.scene.wardrobe;
  const out = { ownedIds: w.ownedIds?.size, itemsTotal: w.items.length };
  // verifica cada aba: itens filtrados devem ser todos owned
  out.tabs = {};
  for (const t of ['head','face','neck','body','hand','feet','color']) {
    w.tab = t; w.page = 0; await w._renderGrid();
    const items = t === 'color' ? w._ownedColors() : w._filteredItems();
    out.tabs[t] = { shown: items.length, allOwned: items.every(i => i.owned !== false && (t==='color' || w.ownedIds.has(i.id))) };
  }
  w.tab = 'body'; w.page = 0; await w._renderGrid();
  out.cellsBody = w.cells.length;
  // procura textos de preco/cadeado no grid
  let bad = 0;
  w._gridCont.each(c => c.list?.forEach?.(o => { if (o.type==='Text' && /[0-9]+c|🔒|Search/.test(o.text||'')) bad++; }));
  out.priceOrLockTexts = bad;
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errs.length ? errs : 'none');
await p.screenshot({ path: 'tools/shots/inv-check.png' });
await b.close();
