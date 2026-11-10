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
  const clips = [v.art, ...v.items.values()];
  const hist = {};
  for (const c of clips) {
    const orig = c._drawShape.bind(c);
    c._drawShape = async (ctx, ch, world, color, scale) => {
      const k = Math.max(Math.hypot(world.a, world.b), Math.hypot(world.c, world.d));
      const key = 'k=' + k.toFixed(2) + ' eff=' + (scale * Math.min(k, 8)).toFixed(2);
      hist[key] = (hist[key] || 0) + 1;
      return orig(ctx, ch, world, color, scale);
    };
  }
  pg.setAction('throw');
  await new Promise(r => setTimeout(r, 800));
  return hist;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
