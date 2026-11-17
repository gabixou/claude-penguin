import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const url = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const ss = sc._ss;
  const W = Math.ceil(760 * ss), H = Math.ceil(480 * ss);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.setTransform(ss, 0, 0, ss, 0, 0);
  const items = [];
  for (const s of (sc.movieLayers || [])) if (s.canvas) items.push({ d: s.depth, cv: s.canvas, ox: s.ox, oy: s.oy });
  for (const d of (sc._dynList || [])) if (d.canvas) items.push({ d: d.depth, cv: d.canvas, ox: d.ox, oy: d.oy });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) {
    ctx.drawImage(it.cv, it.ox / ss, it.oy / ss, it.cv.width / ss, it.cv.height / ss);
  }
  return c.toDataURL('image/png');
});
if (url.startsWith('data:')) fs.writeFileSync('shots/bg-segs.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('saved', url.length);
await b.close();
