import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(800);
const res = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.lives = 0; g._gameOver();
  await sleep(400);
  const btns = g._buttons().map(b => ({ path: b.path, id: b.id ?? null, rel: b.release.replace(/\s+/g,' ').slice(0,90), b: b.bounds.map(v=>Math.round(v)) }));
  // tambem: entries com acts dentro de gameOver_mc
  const { entries } = g.movie.collectInteractive();
  const go = entries.filter(e => e.path.startsWith('gameOver_mc')).map(e => ({ path: e.path, id: e.id, acts: e.acts ? Object.keys(e.acts) : null, rel: e.acts?.release ? e.acts.release.replace(/\s+/g,' ').slice(0,60) : null, b: e.bounds?.map(v=>Math.round(v)) }));
  return { btns, go };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
