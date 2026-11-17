import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
await p.screenshot({ path: 'shots/gp-town-idle.png' });
//: gp world coords?
// dance_btn walk=[342,205] no sistema 760x480; gp renderiza 4:3 ~ letterbox
// tenta hover em varios pontos ao redor
for (const [x, y, tag] of [[342, 205, 'a'], [330, 195, 'b'], [350, 210, 'c'], [320, 180, 'd']]) {
  await p.mouse.move(x, y);
  await p.waitForTimeout(400);
}
await p.screenshot({ path: 'shots/gp-town-hover1.png' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/gp-town-hover2.png' });
// afasta e volta
await p.mouse.move(600, 400);
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/gp-town-out.png' });
console.log('done');
await b.close();
