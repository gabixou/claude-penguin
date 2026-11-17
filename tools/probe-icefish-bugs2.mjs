import { chromium } from 'playwright-core';
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
await p.waitForTimeout(800);

// electro: força o goto e loga frames do penguin
const electro = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.isHit = true;
  g.movie.goto('penguin', 'electro', true);
  const frames = [];
  for (let i = 0; i < 80; i++) { frames.push(g._frame('penguin')); await sleep(50); }
  const uniq = [...new Set(frames)];
  return { uniq, first30: frames.slice(0, 30), isHit: g.model.isHit };
});
console.log('ELECTRO:', JSON.stringify(electro));

// game over: dump TODAS as entries interativas (sem filtro release)
const over = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.lives = 0; g.model.isHit = false;
  g._gameOver();
  await sleep(500);
  const { entries } = g.movie.collectInteractive();
  return entries.map(e => ({ path: e.path, id: e.id, name: e.name,
    acts: e.acts ? Object.keys(e.acts) : null,
    rel: e.acts?.release ? e.acts.release.replace(/\s+/g,' ').slice(0,70) : null,
    b: e.bounds ? e.bounds.map(v=>Math.round(v)) : null }));
});
console.log('ENTRIES:', JSON.stringify(over, null, 1));
await b.close();
