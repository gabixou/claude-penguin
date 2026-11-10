import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const pg = window.__penguin;
  const ls = pg.scene && pg.scene.loadingScreen;
  return pg.view.items.size === 6 && ls && !ls.visible;
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tools/shots/probe-outfit4.png' });
console.log('done');
await b.close();
