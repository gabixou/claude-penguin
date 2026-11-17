import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
const fails = [];
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') fails.push(m.text().slice(0, 160)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
const res = await p.evaluate(async () => {
  const w = window.__penguin.scene.wardrobe;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const report = {};
  for (const t of w.cats) {
    if (t === 'color') continue;
    w.tab = t; w.page = 0; w._renderGrid();
    // espera ate todas as celulas terem imagem ou timeout 15s
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const pending = w.cells.filter(c => !c.list.find(o => o.type === 'Image'));
      if (!pending.length) break;
    }
    const noImg = w.cells.filter(c => !c.list.find(o => o.type === 'Image')).map(c => c.item?.id ?? c.itemId ?? '?');
    report[t] = { cells: w.cells.length, noImg };
  }
  return report;
});
console.log(JSON.stringify(res));
console.log('fails:', fails.slice(0, 15));
await b.close();
