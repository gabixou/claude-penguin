import { chromium } from 'playwright-core';
const port = process.argv[2] || '3000';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const t0 = Date.now();
await p.goto('http://localhost:' + port, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__game?.scene?.isActive?.('RoomScene') && window.__penguin?.scene?._movieReady, null, { timeout: 300000, polling: 500 }).catch(() => {});
console.log('movieReady em', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await b.close();
