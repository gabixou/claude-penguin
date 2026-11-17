import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(5000);
// start direto
await p.evaluate(() => { const n = window.__penguin.scene._minigame._native; n._onPlay(); });
await p.waitForTimeout(2000);
const g = await p.evaluate(() => {
  const n = window.__penguin.scene._minigame._native;
  return n._buttons().map(b => ({ path: b.path, rel: b.release.replace(/\s+/g,' ').slice(0,70), b: b.bounds.map(v=>Math.round(v)) }));
});
console.log(JSON.stringify(g, null, 1));
await b.close();
