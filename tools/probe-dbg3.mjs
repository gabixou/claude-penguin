import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('roundup'));
await p.waitForFunction(() => !!document.querySelector('iframe[src*="pufflescape"]'), null, { timeout: 20000 });
const dbg = await p.evaluate(() => {
  const mg = window.__penguin.scene._minigame;
  return { ctor: mg?.constructor?.name, hasHandler: '_handleMessage' in (mg || {}), onMsg: mg?._onMessage, proto: Object.getOwnPropertyNames(Object.getPrototypeOf(mg || {})) };
});
console.log('DBG:', JSON.stringify(dbg));
await b.close();
