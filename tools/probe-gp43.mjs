import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
// gp em 4:3
const g = await b.newPage({ viewport: { width: 1024, height: 768 } });
await g.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await g.waitForTimeout(12000);
await g.screenshot({ path: 'shots/gp-town-43.png' });
await g.close();
// clone no mesmo viewport
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: 'shots/clone-town-43.png' });
await b.close();
console.log('done');
