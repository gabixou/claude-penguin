import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(1500);
const frames = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
for (const f of frames) {
  const url = await p.evaluate(async (fr) => {
    const m = window.__penguin.scene.movie;
    const sp = m.sprites['88'];
    const entries = sp.frames[fr - 1] || [];
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#20304a'; ctx.fillRect(0, 0, 400, 300); // fundo noite p/ ver neon
    // centraliza: bounds das entries
    const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    const bb = m._boundsOfEntries(entries, ID, 'x88');
    let ox = 0, oy = 0;
    if (bb) { ox = 200 - (bb[0] + bb[2]) / 2; oy = 150 - (bb[1] + bb[3]) / 2; }
    ctx.translate(ox, oy);
    await m._drawEntries(ctx, entries, ID, 'x88', { mult: [1,1,1,1], add: [0,0,0,0] }, 2, 0);
    return c.toDataURL('image/png');
  }, f);
  fs.writeFileSync(`shots/s88-f${f}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log('done');
await b.close();
