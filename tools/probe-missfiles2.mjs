import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view?._warmDone === true, null, { timeout: 60000 });

const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const v = scene.localPlayer.view;
  const lib = await scene.penguinLibrary;
  const out = { misses: new Map(), hits: 0 };
  const movies = new Set([lib.movie]);
  for (const it of v.items.values()) if (it.m) movies.add(it.m);
  const restores = [];
  for (const m of movies) {
    const orig = m.artCanvas;
    const base = (m.base || '').split('/').slice(-2).join('/');
    m.artCanvas = function (file, ch, scale, bg) {
      const key = file + '|' + +scale.toFixed(3);
      const had = this._artCache && this._artCache.has(key);
      if (had) out.hits++;
      else out.misses.set(base + ':' + file.split('/').pop() + '@' + +scale.toFixed(3), (out.misses.get(base + ':' + file.split('/').pop() + '@' + +scale.toFixed(3)) || 0) + 1);
      return orig.call(this, file, ch, scale, bg);
    };
    restores.push(() => { m.artCanvas = orig; });
  }
  const lp = scene.localPlayer;
  const targets = [[300, 400], [500, 300], [600, 450], [350, 350], [550, 380], [400, 420]];
  for (const [x, y] of targets) { lp.moveTo(x, y, 400); await new Promise(r => setTimeout(r, 900)); }
  await new Promise(r => setTimeout(r, 1500));
  restores.forEach(f => f());
  return { distinct: out.misses.size, totalMissCalls: [...out.misses.values()].reduce((a, b) => a + b, 0), hits: out.hits, sample: [...out.misses.entries()].slice(0, 40) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
