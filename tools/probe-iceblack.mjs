import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(5000);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(6000);
await p.screenshot({ path: 'tools/tools/shots/icefish-black.png' });
// mede fps de render
const fps = await p.evaluate(() => new Promise(res => {
  const n = window.__penguin.scene._minigame._native;
  let c = 0; const t0 = performance.now();
  const tick = () => { c++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(c / 2); };
  requestAnimationFrame(tick);
}));
console.log('fps:', fps);
await b.close();
