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
  const out = { perMovie: {} };
  const movies = new Set([lib.movie]);
  for (const it of v.items.values()) if (it.m) movies.add(it.m);
  const tag = (m) => (m.base || '?').split('/').slice(-2).join('/');
  const restores = [];
  for (const m of movies) {
    const orig = m.artCanvas;
    const t = tag(m);
    out.perMovie[t] = { miss: 0, hit: 0, cacheSize: m._artCache?.size };
    m.artCanvas = function (file, ch, scale, bg) {
      const key = file + '|' + (+scale).toFixed(3);
      const had = this._artCache && this._artCache.has(key);
      if (had) out.perMovie[t].hit++; else out.perMovie[t].miss++;
      return orig.call(this, file, ch, scale, bg);
    };
    restores.push(() => { m.artCanvas = orig; });
  }
  // roda warmFrames de novo com contadores ativos — mostra o que o 1o warm nao cobriu
  const t0 = performance.now();
  await v.warmFrames();
  out.warm2ms = +(performance.now() - t0).toFixed(0);
  restores.forEach(f => f());
  for (const m of movies) { const t = tag(m); out.perMovie[t].cacheSizeAfter = m._artCache?.size; }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
