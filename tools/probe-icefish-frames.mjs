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

// renderiza cada frame do penguin e compara pixels da regiao do pinguim
const res = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g._destroyed = true;
  cancelAnimationFrame(g._raf);
  const c = document.createElement('canvas');
  c.width = 1520; c.height = 960;
  const shots = {};
  for (const f of [1, 2, 3, 10, 11, 12, 13]) {
    g.movie.goto('penguin', f, false);
    g.movie.tick();
    await sleep(250);
    await g.movie.renderFrame(undefined, c, 2);
    const ctx = c.getContext('2d');
    shots[f] = ctx.getImageData(700, 30, 280, 260).data;
  }
  // diff frame3 vs cada electro frame
  const diff = (a, b2) => {
    let d = 0;
    for (let i = 0; i < a.length; i += 4)
      d += Math.abs(a[i] - b2[i]) + Math.abs(a[i+1] - b2[i+1]) + Math.abs(a[i+2] - b2[i+2]);
    return d;
  };
  const base = shots[3];
  const out = {};
  for (const f of [1, 2, 10, 11, 12, 13]) out['f' + f + '_vs_f3'] = diff(shots[f], base);
  out.f10_vs_f13 = diff(shots[10], shots[13]);
  out.f1_vs_f2 = diff(shots[1], shots[2]);
  return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
