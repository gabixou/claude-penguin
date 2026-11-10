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
// pega o canvas e as coordenadas do grid
const info = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const grid = w._gridCont.getBounds();
  const canvas = s.game.canvas;
  const rect = canvas.getBoundingClientRect();
  return { grid: {x: grid.x, y: grid.y, w: grid.width, h: grid.height},
    canvas: {x: rect.x, y: rect.y, w: rect.width, h: rect.height, cw: canvas.width, ch: canvas.height} };
});
console.log(JSON.stringify(info));
// screenshot da região do grid
const sx = Math.round(info.canvas.x + info.grid.x * (info.canvas.w / 760));
const sy = Math.round(info.canvas.y + info.grid.y * (info.canvas.h / 480));
const sw = Math.round(info.grid.w * (info.canvas.w / 760));
const sh = Math.round(info.grid.h * (info.canvas.h / 480));
await p.screenshot({ path: 'tools/shots/grid-zoom.png', clip: { x: sx, y: sy, width: sw, height: sh } });
console.log('crop:', { sx, sy, sw, sh });
await b.close();
