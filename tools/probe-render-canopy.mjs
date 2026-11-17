import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 900, height: 500 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(1500);
const url = await p.evaluate(async () => {
  const m = window.__penguin.scene.movie;
  const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  const COL = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
  const c = document.createElement('canvas');
  c.width = 900; c.height = 480;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#20304a'; ctx.fillRect(0, 0, 900, 480);
  let x = 20;
  for (const [sid, fr] of [['151', 1], ['151', 2], ['150', 5], ['150', 30], ['150', 45]]) {
    const sp = m.sprites[sid];
    const entries = sp.frames[fr - 1] || [];
    const bb = m._boundsOfEntries(entries, ID, 'x');
    ctx.fillStyle = '#fff'; ctx.font = '13px monospace';
    ctx.fillText(`sprite ${sid} frame ${fr}`, x, 15);
    ctx.save();
    ctx.translate(x, 30);
    const sc = bb ? Math.min(3, 200 / Math.max(1, bb[2] - bb[0]), 120 / Math.max(1, bb[3] - bb[1])) : 1;
    ctx.scale(sc, sc);
    ctx.translate(bb ? -bb[0] : 0, bb ? -bb[1] : 0);
    await m._drawEntries(ctx, entries, ID, 'x', COL, 1, 0);
    ctx.restore();
    x += 210;
  }
  return c.toDataURL('image/png');
});
fs.writeFileSync('shots/canopy-frames.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('done');
await b.close();
