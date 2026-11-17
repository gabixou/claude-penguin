import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const hits = [];
for (let y = 120; y <= 420 && hits.length < 8; y += 30) {
  for (let x = 300; x <= 700 && hits.length < 8; x += 30) {
    await p.mouse.move(x, y);
    await p.waitForTimeout(120);
    const h = await p.evaluate(() => window.penguinRoom.hovered);
    if (h) { hits.push({ x, y, h }); console.log('HIT', x, y, JSON.stringify(h)); }
  }
}
console.log('total', hits.length, JSON.stringify(hits.slice(0, 10)));
await b.close();
