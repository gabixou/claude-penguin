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
  const played = {};
  const orig = g._playIdx.bind(g);
  g._playIdx = (i) => { played[i] = (played[i]||0)+1; return orig(i); };
  g._onPlay();
  // autoplay: clica para pescar periodicamente
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    // simula clique de pesca (solta/guarda isca)
    try { g._fishDrop(); g._newWorm(0); } catch(e) {}
  }
  return { played, fishCaught: g.model.fishCaught, ticks: g.model.ticks };
});
console.log(JSON.stringify(out));
await b.close();
