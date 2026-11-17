import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const r = await p.evaluate(() => {
  const room = window.penguinRoom;
  const out = {};
  for (const btn of room.buttons || []) {
    const m = btn.mask;
    if (!m?.alpha) { out[btn.path] = 'no mask'; continue; }
    const a = m.alpha; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    const W = m.width;
    for (const [k, v] of Object.entries(a)) {
      if (!v) continue;
      const i = Number(k), x = i % W, y = (i / W) | 0;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    out[btn.path] = { bbox: [x0, y0, x1, y1], hits: n, w: m.width, h: m.height };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
