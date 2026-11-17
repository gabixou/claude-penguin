import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(3000);

const frameCount = () => p.evaluate(() => {
  const g = window.__penguin.scene.game;
  return { running: g.loop.running, frame: g.loop.frame };
});

const f1 = await frameCount();
await p.waitForTimeout(1000);
const f2 = await frameCount();
console.log('antes: running=%s, frames em 1s: %d', f1.running, f2.frame - f1.frame);

await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForTimeout(2500);
const f3 = await frameCount();
await p.waitForTimeout(1000);
const f4 = await frameCount();
console.log('com jogo: running=%s, frames em 1s: %d', f3.running, f4.frame - f3.frame);
console.log('overlay:', await p.evaluate(() => !!document.querySelector('iframe[src*="beancounters"]')));

// fecha via X generico -> loop deve acordar
await p.evaluate(() => document.querySelector('.minigame-close, iframe') && window.__penguin.scene._closeMinigame());
await p.waitForTimeout(1000);
const f5 = await frameCount();
await p.waitForTimeout(1000);
const f6 = await frameCount();
console.log('apos fechar: running=%s, frames em 1s: %d, overlay=%s', f6.running, f6.frame - f5.frame,
  await p.evaluate(() => !!document.querySelector('iframe[src*="beancounters"]')));
await b.close();
