import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(30000);
await p.waitForFunction(() => {
  const w = window.__penguin.scene.wardrobe;
  if (!w?.cells?.length) return false;
  return w.cells.every(c => c.list.some(k => k.type === 'Image' && k.texture?.key?.startsWith('wardrobe_icon_')));
}, null, { timeout: 30000 }).catch(() => {});
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  if (!img) return 'no img';
  const bounds = img.getBounds();
  const cv = s.game.canvas;
  const scaleX = cv.width / 760, scaleY = cv.height / 480;
  const x = Math.round(bounds.x * scaleX), y = Math.round(bounds.y * scaleY);
  const ww = Math.round(bounds.width * scaleX), hh = Math.round(bounds.height * scaleY);
  const c2 = document.createElement('canvas');
  c2.width = cv.width; c2.height = cv.height;
  const ctx = c2.getContext('2d');
  ctx.drawImage(cv, 0, 0);
  const d = ctx.getImageData(x, y, Math.max(1,ww), Math.max(1,hh)).data;
  let dark = 0, colored = 0, total = d.length/4;
  const colors = {};
  for (let i = 0; i < d.length; i += 4) {
    const r=d[i], g=d[i+1], b=d[i+2], a=d[i+3];
    if (a < 30) continue;
    if (Math.abs(r-242)>20 || Math.abs(g-247)>20 || Math.abs(b-253)>20) dark++;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    if (max - min > 30 && max > 100) colored++;
    const key = (r>>4)+','+(g>>4)+','+(b>>4);
    colors[key] = (colors[key]||0)+1;
  }
  const topColors = Object.entries(colors).sort((a,b)=>b[1]-a[1]).slice(0,8);
  return { bounds: {x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height}, px: {x,y,ww,hh}, dark, colored, total, topColors };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
