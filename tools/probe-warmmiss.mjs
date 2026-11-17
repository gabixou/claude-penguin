import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') console.log('CONS', m.text().slice(0, 300)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view?._warmDone === true, null, { timeout: 60000 });

const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const v = scene.localPlayer.view;
  const lib = await scene.penguinLibrary;
  const out = { before: lib.movie._artCache?.size, warmMiss: 0, warmErr: null };
  // conta misses durante um SEGUNDO warm manual
  const orig = lib.movie.artCanvas;
  lib.movie.artCanvas = function (file, ch, scale, bg) {
    const key = file + '|' + (+scale).toFixed(3);
    if (!(this._artCache && this._artCache.has(key))) out.warmMiss++;
    return orig.call(this, file, ch, scale, bg);
  };
  try { await v.warmFrames(); } catch (e) { out.warmErr = String(e).slice(0, 300); }
  lib.movie.artCanvas = orig;
  out.after = lib.movie._artCache?.size;
  return out;
});
console.log(JSON.stringify(r));
await b.close();
