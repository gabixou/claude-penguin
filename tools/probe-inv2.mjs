import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(8000);
const r = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return { tab: w.tab, cells: w.cells.length, pages: w._totalPages(), doll: !!w._dollCont?.list?.length };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'tools/shots/inv-modal.png' });
console.log('errors:', errs.length ? errs : 'none');
await b.close();
