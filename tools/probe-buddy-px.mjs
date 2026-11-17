import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(3500);
const st = await p.evaluate(async () => {
  const w = window.__penguin.scene.buddyWindow;
  if (!w._ready) await new Promise(r => setTimeout(r, 3000));
  w.open(); await new Promise(r => setTimeout(r, 1200));
  // alpha bbox do canvas (em pixels do canvas; canvas = mundo*2)
  const d = w.ctx.getImageData(0, 0, w.canvas.width, w.canvas.height).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < w.canvas.height; y += 4) for (let x = 0; x < w.canvas.width; x += 4) {
    if (d[(y * w.canvas.width + x) * 4 + 3] > 10) {
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return {
    canvas: [w.canvas.width, w.canvas.height],
    alphaBboxWorld: [x0 / 2, y0 / 2, x1 / 2, y1 / 2], paintedSamples: n,
    winBounds: w.winBounds, imgDW: w.img.displayWidth,
    texts: [w.titleText?.x, w.titleText?.y, w.rowTexts?.[0]?.x, w.rowTexts?.[0]?.y],
  };
});
console.log(JSON.stringify(st, null, 1));
await p.screenshot({ path: 'shots/buddy-px.png' });
await b.close();
