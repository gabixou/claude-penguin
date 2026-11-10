import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(20000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  if (!w?.cells?.length) return 'no cells';
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  if (!img) return 'no img';
  return {
    x: img.x, y: img.y,
    displayWidth: img.displayWidth, displayHeight: img.displayHeight,
    width: img.width, height: img.height,
    alpha: img.alpha, visible: img.visible,
    scaleX: img.scaleX, scaleY: img.scaleY
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
