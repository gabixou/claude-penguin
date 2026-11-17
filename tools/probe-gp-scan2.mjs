import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const getCanopy = () => p.evaluate(() => {
  const ph = window.penguinRoom.movie.playheads;
  const e = ph instanceof Map ? [...ph.entries()] : Object.entries(ph || {});
  const c = e.find(([k]) => k === 'dance_canopy_mc');
  return c ? (c[1].frame ?? c[1]) : null;
});
console.log('canopy idle', await getCanopy());
const hits = [];
outer:
for (let y = 100; y <= 450; y += 25) {
  for (let x = 250; x <= 750; x += 25) {
    await p.mouse.move(x, y);
    await p.waitForTimeout(90);
    const c = await getCanopy();
    if (c === 2) { hits.push({ x, y }); console.log('CANOPY2 at', x, y); if (hits.length >= 5) break outer; }
  }
}
console.log('done', JSON.stringify(hits));
await b.close();
