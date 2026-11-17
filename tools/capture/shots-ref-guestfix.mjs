import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
await p.screenshot({ path: 'tools/shots/ref-town-guestfix.png' });
await b.close();
