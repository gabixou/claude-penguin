import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const p = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await p.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
const r = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const b = c.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight };
});
console.log(JSON.stringify(r));
await browser.close();