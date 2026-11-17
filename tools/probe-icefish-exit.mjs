import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
// captura reward
await p.evaluate(() => { window.__rewards = []; const nc = window.__penguin.scene.network; const orig = nc.send.bind(nc); nc.send = (op, d) => { if (op === 'MINIGAME_REWARD') window.__rewards.push(d); return orig(op, d); }; });
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(5000);
await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent === 'PLAY')?.click());
await p.waitForTimeout(1500);
// simula 5 peixes pegos
await p.evaluate(() => { const g = window.__penguin.scene._minigame?._native; g.model.orangeFish = 5; g.model.fishCaught = 5; g.started = true; });
// clica EXIT
await p.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent === 'EXIT')?.click());
await p.waitForTimeout(1500);
const st = await p.evaluate(() => ({
  overlayOpen: !!window.__penguin.scene._minigame?.isOpen,
  rewards: window.__rewards,
  loopRunning: window.__penguin.scene.game.loop.running,
  room: window.__penguin.scene.currentRoom,
}));
console.log(JSON.stringify(st));
await b.close();
