import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(25000);
// força render e verifica pixels na região do ícone
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  if (!w?.cells?.length) return 'no cells';
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  if (!img) return 'no img';
  const bounds = img.getBounds();
  // amostra pixels do canvas na região do ícone
  const cv = s.game.canvas;
  const rect = cv.getBoundingClientRect();
  const scaleX = cv.width / 760, scaleY = cv.height / 480;
  const x = Math.round(bounds.x * scaleX), y = Math.round(bounds.y * scaleY);
  const ww = Math.round(bounds.width * scaleX), hh = Math.round(bounds.height * scaleY);
  const c2 = document.createElement('canvas');
  c2.width = cv.width; c2.height = cv.height;
  const ctx = c2.getContext('2d');
  ctx.drawImage(cv, 0, 0);
  const d = ctx.getImageData(x, y, Math.max(1,ww), Math.max(1,hh)).data;
  let nonWhite = 0, nonTransparent = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i+3] > 30) nonTransparent++;
    if (!(d[i] > 240 && d[i+1] > 240 && d[i+2] > 240)) nonWhite++;
  }
  return { bounds: {x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height}, px: {x,y,ww,hh}, nonWhite, nonTransparent, total: d.length/4 };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
