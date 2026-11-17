import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', m => console.log('PG>', m.text().slice(0,150)));
p.on('pageerror', e => console.log('ERR>', String(e).slice(0,200)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('roundup'));
await p.waitForFunction(() => !!document.querySelector('iframe[src*="pufflescape"]'), null, { timeout: 20000 });
const dbg = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const mg = s._minigame;
  const f = document.querySelector('iframe[src*="pufflescape"]');
  return { mg: !!mg, onMsg: typeof mg?._onMessage, el: !!mg?.el, frame: !!mg?.frame,
    sameWin: mg?.frame ? mg.frame.querySelector('iframe') === f : null,
    cwMatch: f ? (f.contentWindow === mg?.frame?.querySelector('iframe')?.contentWindow) : null,
    net: !!s.network };
});
console.log('DBG:', JSON.stringify(dbg));
await b.close();
