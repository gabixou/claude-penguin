import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));

async function boot(tag) {
  const t = Date.now();
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
  const readyMs = Date.now() - t;
  // detalhes: cache hit?
  const info = await p.evaluate(() => {
    const s = window.__penguin.scene;
    return { room: s.currentRoom, ss: s._ss, layers: s.movieLayers?.length };
  });
  console.log(tag, 'ready em', (readyMs / 1000).toFixed(1) + 's', JSON.stringify(info));
  return readyMs;
}

await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await boot('COLD');
await p.waitForTimeout(2000); // deixa idbPut terminar (ja esta no boot, mas margem)
await p.reload({ waitUntil: 'domcontentloaded' });
await boot('WARM1');
await p.reload({ waitUntil: 'domcontentloaded' });
await boot('WARM2');

// FPS depois de tudo assentar (warm-up idle deve estar rodando leve)
await p.waitForTimeout(5000);
const fps = await p.evaluate(() => new Promise((res) => {
  const d = []; let last = performance.now(); const lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {}
  const loop = (t) => { d.push(t - last); last = t; d.length < 240 ? requestAnimationFrame(loop) : res({ d, lt }); };
  requestAnimationFrame(loop);
}));
fps.d.sort((a, b) => a - b);
console.log('FPS idle:', JSON.stringify({
  avg: +(fps.d.reduce((x, y) => x + y) / fps.d.length).toFixed(1),
  p95: +fps.d[Math.floor(fps.d.length * .95)].toFixed(1),
  fps: +(1000 / (fps.d.reduce((x, y) => x + y) / fps.d.length)).toFixed(1),
  longtasks: fps.lt.slice(0, 10),
}));
await b.close();
