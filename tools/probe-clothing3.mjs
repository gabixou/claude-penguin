import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
for (let i = 0; i < 6; i++) {
  await p.waitForTimeout(5000);
  const n = await p.evaluate(() => window.__penguin.view.items.size);
  console.log('t+' + ((i + 1) * 5) + 's items=' + n);
  if (n === 6) break;
}
await p.screenshot({ path: 'tools/shots/probe-outfit2.png' });
await b.close();
