import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, args: ['--window-size=1520,960'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=town', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.evaluate(() => window.__penguin.scene.catalogue?.open?.('pets'));
await p.waitForTimeout(5000);
const stats = await p.evaluate(async () => {
  const c = window.__penguin.scene.catalogue;
  const mv = c.movie;
  // desliga flat scale pra medir k real
  mv.artFlatScale = false;
  const ks = [];
  const orig = mv._drawShape.bind(mv);
  mv._drawShape = async function (ctx, ch, world, color, scale, file) {
    const k = Math.max(Math.hypot(world.a, world.b), Math.hypot(world.c, world.d), 1e-6);
    ks.push(+Math.min(k, 8).toFixed(3));
    return orig(ctx, ch, world, color, scale, file);
  };
  c._pageCache?.clear?.();
  const t0 = performance.now();
  await c._render(true);
  const renderMs = Math.round(performance.now() - t0);
  await new Promise(r => setTimeout(r, 4000));
  const hist = {};
  for (const k of ks) hist[k] = (hist[k] || 0) + 1;
  const buckets = {};
  for (const k of ks) {
    const b = k <= 1 ? 1 : Math.min(4, Math.ceil(k * 2) / 2);
    buckets[b] = (buckets[b] || 0) + 1;
  }
  return { draws: ks.length, renderMs, kHist: Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,15), bucketHist: buckets };
});
console.log(JSON.stringify(stats, null, 1));
await b.close();
