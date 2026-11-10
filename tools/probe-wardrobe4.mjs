import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(12000);
await p.screenshot({ path: 'tools/shots/wardrobe-v2.png' });
// scroll test: head tab tem 19 itens -> 5 rows
const geo = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return { cells: w.cells.length, maxScroll: w._gridMaxScroll, masked: !!w._gridCont.mask };
});
console.log(JSON.stringify(geo));
await b.close();
