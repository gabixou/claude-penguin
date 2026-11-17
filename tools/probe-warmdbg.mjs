import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('CONS', m.text().slice(0, 300)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view?._warmDone === true, null, { timeout: 60000 });

const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const v = scene.localPlayer.view;
  const lib = await scene.penguinLibrary;
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  const ctx = cv.getContext('2d');
  const out = { artType: v.art?.constructor?.name, draws: [] };
  for (const f of [9, 1]) {
    const af = lib.animationFrame(v.look, f);
    try {
      const t = performance.now();
      await v.art.draw(ctx, af, 5.0625);
      out.draws.push({ f, af, ms: +(performance.now() - t).toFixed(1), ok: true });
    } catch (e) {
      out.draws.push({ f, af, err: String(e).slice(0, 300), ok: false });
    }
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
