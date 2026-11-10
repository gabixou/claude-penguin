import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(30000);
await p.waitForFunction(() => {
  const w = window.__penguin.scene.wardrobe;
  return w?.cells?.every(c => c.list.some(k => k.type === 'Image'));
}, null, { timeout: 30000 }).catch(() => {});
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  if (!img) return null;
  const bounds = img.getBounds();
  const tex = s.textures.get(img.texture.key);
  return { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height, texKey: img.texture.key,
    texW: tex.source[0].width, texH: tex.source[0].height,
    imgX: img.x, imgY: img.y, imgScaleX: img.scaleX, imgScaleY: img.scaleY };
});
console.log('icon:', JSON.stringify(r));
// screenshot da região do grid inteiro
const grid = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  if (!w?._gridCont) return null;
  const b = w._gridCont.getBounds();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
});
console.log('grid:', JSON.stringify(grid));
if (grid) {
  const cv = await p.evaluate(() => {
    const c = window.__penguin.game.canvas;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cw: c.width, ch: c.height };
  });
  const sx = Math.round(cv.x + grid.x * (cv.w / 760));
  const sy = Math.round(cv.y + grid.y * (cv.h / 480));
  const sw = Math.round(grid.w * (cv.w / 760));
  const sh = Math.round(grid.h * (cv.h / 480));
  await p.screenshot({ path: 'tools/shots/grid-zoom.png', clip: { x: sx, y: sy, width: sw, height: sh } });
  console.log('crop:', { sx, sy, sw, sh });
}
await b.close();
