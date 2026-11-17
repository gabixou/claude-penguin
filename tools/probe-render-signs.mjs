import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 900, height: 700 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(1500);
// renderiza sprites 44 (sign) e 36 (glow) todos os frames, em grade
const url = await p.evaluate(async () => {
  const m = window.__penguin.scene.movie;
  const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  const COL = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
  const c = document.createElement('canvas');
  c.width = 900; c.height = 700;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a2438'; ctx.fillRect(0, 0, 900, 700);
  ctx.font = '14px monospace'; ctx.fillStyle = '#fff';
  let y = 10;
  for (const sid of ['44', '36']) {
    const sp = m.sprites[sid];
    for (let f = 0; f < sp.frames.length; f++) {
      ctx.fillText(`sprite ${sid} frame ${f + 1}`, 10, y + 40);
      const entries = sp.frames[f];
      const bb = m._boundsOfEntries(entries, ID, 'x');
      // desenha com offset para caber na linha
      ctx.save();
      ctx.translate(10, y + 60);
      const sc = bb ? Math.min(2, 380 / (bb[2] - bb[0]), 160 / (bb[3] - bb[1])) : 1;
      ctx.scale(sc, sc);
      ctx.translate(bb ? -bb[0] : 0, bb ? -bb[1] : 0);
      await m._drawEntries(ctx, entries, ID, 'x', COL, 1, 0);
      ctx.restore();
      y += 190;
    }
  }
  return c.toDataURL('image/png');
});
fs.writeFileSync('shots/signs-all.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('done');
await b.close();
