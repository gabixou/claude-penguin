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
  const out = { missKeys: new Set(), missCalls: 0, hitCalls: 0, movies: 0 };
  // patch own-property apenas nos movies do pinguim (base + itens)
  const movies = new Set([lib.movie]);
  for (const it of v.items.values()) if (it.m) movies.add(it.m);
  const restores = [];
  for (const m of movies) {
    const orig = m.artCanvas;
    m.artCanvas = function (file, ch, scale, bg) {
      const key = file + '|' + +scale.toFixed(3);
      const had = this._artCache && this._artCache.has(key);
      if (had) out.hitCalls++; else { out.missCalls++; out.missKeys.add(key); }
      return orig.call(this, file, ch, scale, bg);
    };
    restores.push(() => { m.artCanvas = orig; });
    out.movies++;
  }
  const lp = scene.localPlayer;
  const targets = [[300, 400], [500, 300], [600, 450], [350, 350], [550, 380], [400, 420]];
  for (const [x, y] of targets) { lp.moveTo(x, y, 400); await new Promise(r => setTimeout(r, 900)); }
  await new Promise(r => setTimeout(r, 1500));
  restores.forEach(f => f());
  return { missCalls: out.missCalls, distinctMiss: out.missKeys.size, hitCalls: out.hitCalls, movies: out.movies };
});
console.log(JSON.stringify(r));
await b.close();
