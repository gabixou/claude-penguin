import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
try {
    await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForFunction(() => window.penguinRoom?.movie, null, { timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.mouse.move(100, 700);
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'shots/ref-town-idle.png' });
    console.log('GP OK');
} catch (e) { console.log('GP FAIL', e.message.slice(0, 120)); }
await b.close();
