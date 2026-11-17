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
  const m = g.movie;
  g._onPlay();
  await new Promise(r => setTimeout(r, 5000));
  // playheads com tl.sounds nao-vazio
  const info = [];
  for (const [key, h] of m._playheadAll) {
    const snd = h.tl?.sounds;
    if (snd?.length) info.push({ key, frame: h.frame, stopped: h.stopped, sndFrames: snd.map(s=>s.frame+':'+s.ids).join(',') });
  }
  return { info, queue: m._sndQueue, mainFrame: m._mainFrame };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
