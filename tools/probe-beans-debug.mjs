import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('console', m => console.log('CON', m.type(), m.text().slice(0, 150)));
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForSelector('iframe', { timeout: 30000 });
const frame = p.frames().find(f => f.url().includes('beancounters'));
frame.on('console', m => console.log('FCON', m.type(), m.text().slice(0, 150)));
frame.on('pageerror', e => console.log('FERR:', e.message));
await frame.waitForTimeout(20000);
const st = await frame.evaluate(() => ({
  ready: document.readyState,
  state: window.app?.currentState?.(),
  hasStart: !!document.querySelector('.start-button'),
  gameHtml: document.querySelector('.game')?.innerHTML?.slice(0, 200),
  loadingBar: document.querySelector('.loading-bar')?.style?.width,
}));
console.log(JSON.stringify(st, null, 1));
await p.screenshot({ path: 'shots/beans-debug.png' });
await b.close();
