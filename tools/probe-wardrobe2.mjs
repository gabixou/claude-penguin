import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForTimeout(5000);
const r = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  if (!s) return 'no scene';
  s.toggleClothes();
  return 'opened';
});
console.log(r);
await p.waitForTimeout(10000);
await p.screenshot({ path: 'tools/shots/wardrobe-fixed.png' });
const geo = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const w = s?.wardrobe;
  if (!w?.cells?.length) return { cells: 0, open: !!w?.isOpen };
  const c = w.cells[0];
  const b = c.getBounds();
  return { n: w.cells.length, tab: w.tab, x: b.x, y: b.y, w: b.width, h: b.height };
});
console.log(JSON.stringify(geo));
await b.close();
