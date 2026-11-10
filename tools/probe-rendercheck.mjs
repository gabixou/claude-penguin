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
  // verifica se a imagem está dentro dos limites da célula
  const cellBounds = cell.getBounds();
  const imgBounds = img.getBounds();
  return {
    cellBounds: { x: cellBounds.x, y: cellBounds.y, w: cellBounds.width, h: cellBounds.height },
    imgBounds: { x: imgBounds.x, y: imgBounds.y, w: imgBounds.width, h: imgBounds.height },
    imgInside: imgBounds.x >= cellBounds.x && imgBounds.y >= cellBounds.y &&
               imgBounds.x + imgBounds.width <= cellBounds.x + cellBounds.width &&
               imgBounds.y + imgBounds.height <= cellBounds.y + cellBounds.height,
    imgVisible: img.visible, imgAlpha: img.alpha
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
