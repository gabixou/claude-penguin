import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
await p.screenshot({ path: 'shots/gp-town-now.png' });
await b.close();
console.log('done');
