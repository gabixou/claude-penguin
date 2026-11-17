import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
p.on('console', m => { if (m.type() === 'error' || m.text().includes('icefishing')) console.log('CON:', m.text().slice(0, 200)); });
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

const res = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // estado de vitoria: 60 peixes + big fish pego (fluxo real do _bigFish)
  g.model.fishCaught = 60; g.model.orangeFish = 10; g.model.grayFish = 2;
  g.movie.goto('', 39, false);
  g._mullet();
  await sleep(600);
  const m = g.model;
  const btns = g._buttons().map(b => ({ path: b.path, rel: (b.release || '').replace(/\s+/g, ' ').slice(0, 90), b: b.bounds.map(v => Math.round(v)) }));
  const { entries } = g.movie.collectInteractive();
  const go = entries.filter(e => (e.path || '').includes('gameOver')).map(e => ({
    path: e.path, id: e.id, acts: e.acts ? Object.keys(e.acts) : null,
    rel: e.acts?.release ? e.acts.release.replace(/\s+/g, ' ').slice(0, 60) : null,
    b: e.bounds?.map(v => Math.round(v))
  }));
  // textos visiveis no gameOver_mc
  const texts = [];
  for (const e of entries.filter(e => (e.path || '').startsWith('gameOver_mc'))) {
    if (e.text != null) texts.push({ path: e.path, text: String(e.text).slice(0, 80) });
  }
  return {
    model: { won: m.won, over: m.over, running: m.running, fishCaught: m.fishCaught, level: m.level },
    mainFrame: g.movie._mainFrame,
    goVisible: g.movie.pose('gameOver_mc') ? true : 'no-pose',
    btns, go, texts,
    coins: g._coins(),
  };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
