import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(async () => {
  const pg = window.__penguin, v = pg.view;
  // instrumenta _drawShape de todos os clips (art + items)
  const clips = [v.art, ...v.items.values()];
  const hist = {};
  for (const c of clips) {
    const orig = c._drawShape.bind(c);
    c._drawShape = async (ctx, ch, world, color, scale) => {
      const sx = Math.hypot(world.a, world.b), sy = Math.hypot(world.c, world.d);
      const s = Math.max(sx, sy);
      const key = s.toFixed(2);
      hist[key] = (hist[key] || 0) + 1;
      return orig(ctx, ch, world, color, scale);
    };
  }
  const grab = () => ({ ...hist, _n: Object.values(hist).reduce((a, b) => a + b, 0) });
  pg.setAction('idle'); await new Promise(r => setTimeout(r, 400));
  const idle = grab(); for (const k in hist) delete hist[k];
  pg.setAction('dance'); await new Promise(r => setTimeout(r, 900));
  const dance = grab(); for (const k in hist) delete hist[k];
  pg.setAction('throw'); await new Promise(r => setTimeout(r, 500));
  const thr = grab();
  return { idle, dance, thr };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
