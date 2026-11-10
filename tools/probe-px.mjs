import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(10000);
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const cell = w.cells[0];
  const wb = cell.getWorldTransformMatrix();
  const cb = cell.getBounds();
  // amostra pixels do canvas na regiao da celula
  const cv = s.game.canvas;
  const rect = cv.getBoundingClientRect();
  // canvas backing store e supersampled; usa webgl readPixels? mais simples: drawImage do canvas
  const c2 = document.createElement('canvas');
  c2.width = cv.width; c2.height = cv.height;
  const ctx = c2.getContext('2d');
  ctx.drawImage(cv, 0, 0);
  // bounds do cell em coords de mundo do jogo (760x480); canvas cobre isso com scale
  const scaleX = cv.width / 760, scaleY = cv.height / 480;
  const x = Math.round(cb.x * scaleX), y = Math.round(cb.y * scaleY);
  const ww = Math.round(cb.width * scaleX), hh = Math.round(cb.height * scaleY);
  const d = ctx.getImageData(x, y, Math.max(1,ww), Math.max(1,hh)).data;
  let light = 0, tot = 0;
  for (let i = 0; i < d.length; i += 4) { tot++; if (d[i] > 200 && d[i+1] > 210 && d[i+2] > 230) light++; }
  return { cellBounds: {x: cb.x, y: cb.y, w: cb.width, h: cb.height}, px: {x,y,ww,hh}, light, tot,
           gridContPos: {x: w._gridCont.x, y: w._gridCont.y, alpha: w._gridCont.alpha, visible: w._gridCont.visible},
           cellVisible: cell.visible, cellAlpha: cell.alpha };
});
console.log(JSON.stringify(r));
await b.close();
