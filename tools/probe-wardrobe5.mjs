import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(12000);
await p.screenshot({ path: 'tools/shots/wardrobe-original.png' });
const r = await p.evaluate(() => {
  const w = window.__penguin.scene.wardrobe;
  return { cells: w?.cells?.length, page: w?.page, totalPages: w?._totalPages() };
});
console.log(JSON.stringify(r));
await b.close();
