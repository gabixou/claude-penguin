import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForSelector('iframe', { timeout: 30000 });
let outer = p.frames().find(f => f.url().includes('beancounters/index.html'));
await outer.waitForTimeout(3000);
const game = outer.childFrames()[0];
game.on('pageerror', e => console.log('GERR:', e.message));
await game.waitForFunction(() => window.app && document.querySelector('.start-button'), null, { timeout: 90000 });
await game.click('.start-button');
// espera hazards aparecerem e tira 3 screenshots em momentos diferentes
await game.waitForTimeout(2500);
await p.screenshot({ path: 'tools/shots/beans-fixed-t1.png' });
await game.waitForTimeout(2000);
await p.screenshot({ path: 'tools/shots/beans-fixed-t2.png' });
await game.waitForTimeout(2000);
await p.screenshot({ path: 'tools/shots/beans-fixed-t3.png' });
// estado do jogo
const st = await game.evaluate(() => ({
  state: window.app.currentState(),
  hazards: document.querySelectorAll('.hazard').length,
  score: document.querySelector('.score, .points, [class*="score"]')?.textContent
}));
console.log(JSON.stringify(st));
await b.close();
