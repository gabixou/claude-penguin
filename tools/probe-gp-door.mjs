import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
// mouse longe do nightclub
await p.mouse.move(150, 600);
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/gpA-idle.png' });
// hover na porta do nightclub — centro world (348,169) -> screen (469,288)
await p.mouse.move(469, 288, { steps: 5 });
await p.waitForTimeout(300);
await p.screenshot({ path: 'shots/gpA-hover-early.png' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/gpA-hover.png' });
// sai
await p.mouse.move(150, 600, { steps: 5 });
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/gpA-out.png' });
console.log('done');
await b.close();
