import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  window.__rewards = [];
  const nc = window.__penguin.scene.network;
  const orig = nc.send.bind(nc);
  nc.send = (op, d) => { if (op === 'MINIGAME_REWARD') window.__rewards.push(d); return orig(op, d); };
});
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(800);
// derrota: zera vidas e forca game over
await p.evaluate(() => { const g = window.__penguin.scene._minigame._native; g.model.lives = 0; g.model.fishCaught = 17; g.model.orangeFish = 15; g._gameOver(); });
await p.waitForTimeout(800);
const mid = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  return { btns: g._buttons().map(b => ({ path: b.path, rel: (b.release || '').replace(/\s+/g, ' ').slice(0, 50), b: b.bounds.map(v => Math.round(v)) })) };
});
console.log('lose btns:', JSON.stringify(mid));
await p.screenshot({ path: 'shots/icefish-lose.png' });
const clicked = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  const b = g._buttons().find(x => /getCoins|sendGameOver/.test(x.release || ''));
  if (!b) return 'no-button';
  const cx = (b.bounds[0] + b.bounds[2]) / 2, cy = (b.bounds[1] + b.bounds[3]) / 2;
  const r = g.canvas.getBoundingClientRect();
  g.canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + cx / 760 * r.width, clientY: r.top + cy / 480 * r.height, bubbles: true }));
  return 'clicked ' + b.path;
});
console.log('click:', clicked);
await p.waitForTimeout(1200);
const fin = await p.evaluate(() => ({ overlay: !!window.__penguin.scene._minigame?.isOpen, rewards: window.__rewards }));
console.log('final:', JSON.stringify(fin));
await b.close();
