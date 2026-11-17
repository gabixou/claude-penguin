import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
mkdirSync('tools/shots', { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(2500);
// estado normal de gameplay (linha visivel, peixes nadando)
await p.screenshot({ path: 'tools/shots/icefish-gameplay.png' });
// forca jelly hit -> estado de choque (electro + linha shocked)
await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  g.model.level = 2; g.model.mouseY = 300;
  g.movie.goto('jfish1', 3, true);
  const orig = g._hit.bind(g);
  g._hit = (a, bb) => /jfish/.test(a) ? true : orig(a, bb);
});
await p.waitForFunction(() => window.__penguin.scene._minigame._native.model.isHit === true, null, { timeout: 10000 });
await p.waitForTimeout(400); // electro no meio da animacao
await p.screenshot({ path: 'tools/shots/icefish-shock.png' });
// apos electro -> prompt new worm + linha normal
await p.waitForTimeout(1200);
await p.screenshot({ path: 'tools/shots/icefish-prompt.png' });
await b.close();
console.log('shots done');
