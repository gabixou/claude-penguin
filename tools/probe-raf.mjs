import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForSelector('iframe', { timeout: 30000 });
let outer = p.frames().find(f => f.url().includes('beancounters/index.html'));
await outer.waitForTimeout(3000);
const game = outer.childFrames()[0];
await game.waitForFunction(() => window.app && document.querySelector('.start-button'), null, { timeout: 90000 });
await game.click('.start-button');
await game.waitForTimeout(1000);
const r = await game.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let rafN = 0, fxN = 0;
  const perFn = new Map();
  const origFx = window.app.fixedInterval.bind(window.app);
  window.app.fixedInterval = function (fn, ms) {
    const id = origFx(function () {
      fxN++;
      const rec = perFn.get(id); if (rec) rec.n++;
      return fn.apply(this, arguments);
    }, ms);
    perFn.set(id, { n: 0, ms });
    return id;
  };
  function loop() { rafN++; requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  await sleep(5000);
  return { rafN, fxN, perFn: [...perFn.values()].map(s => s.n) };
});
console.log(JSON.stringify(r), '=> rAF ~', (r.rafN / 5).toFixed(1), 'Hz | fx ~', (r.fxN / 5).toFixed(1), 'Hz | porFn:', r.perFn.join(','));
await b.close();
