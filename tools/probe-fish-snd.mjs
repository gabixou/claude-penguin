import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1200);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const played = [];
  const orig = g._playIdx.bind(g);
  g._playIdx = (i) => { played.push(i); return orig(i); };
  g._onPlay();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  await sleep(3000); // ~72 ticks — peixes/puffle tocam sons de timeline
  // força eventos de script: chomp (fishHit), flee, ding (oneup), snip
  g._sfx('chomp'); g._sfx('ding'); g._sfx('snip'); g._sfx('shark'); g._sfx('fishicebox'); g._sfx('fishfleesound');
  // queue state
  return { playedScript: played.slice(-6), queueLen: (g.movie._sndQueue||[]).length,
           sndCache: g._sndCache ? [...g._sndCache.keys()] : [] };
});
console.log(JSON.stringify(out));
await b.close();
