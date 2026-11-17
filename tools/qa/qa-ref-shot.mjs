import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'networkidle', timeout: 60000 });
await new Promise(r => setTimeout(r, 8000));
await p.screenshot({ path: 'tools/shots/ref-spawn-town.png' });
await b.close();
