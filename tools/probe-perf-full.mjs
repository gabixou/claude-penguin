import { chromium } from 'playwright-core';
const URL = 'http://localhost:3000/?penguin=Arenovisk';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));

// ---------- FASE 1: cold load ----------
await p.goto(URL, { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('COLD _movieReady em', ((Date.now() - t0) / 1000).toFixed(1) + 's');

// ---------- FASE 2: warm load (reload, IDB quente) ----------
await p.reload({ waitUntil: 'domcontentloaded' });
const t1 = Date.now();
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('WARM _movieReady em', ((Date.now() - t1) / 1000).toFixed(1) + 's');
await p.waitForTimeout(3000); // warm-up de arte

// ---------- FASE 3: FPS + longtasks em idle ----------
const fps = await p.evaluate(() => new Promise((res) => {
  const deltas = [];
  let last = performance.now();
  const longtasks = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) longtasks.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] });
  } catch {}
  const loop = (t) => {
    deltas.push(t - last); last = t;
    if (deltas.length < 300) requestAnimationFrame(loop);
    else {
      deltas.sort((a, b) => a - b);
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      res({ frames: deltas.length, avgMs: +avg.toFixed(2), p95Ms: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1), maxMs: +deltas[deltas.length - 1].toFixed(1), fps: +(1000 / avg).toFixed(1), longtasks });
    }
  };
  requestAnimationFrame(loop);
}));
console.log('IDLE FPS:', JSON.stringify(fps));

// ---------- FASE 4: FPS durante caminhada ----------
const walkFps = await p.evaluate(() => new Promise((res) => {
  const s = window.__penguin.scene;
  const deltas = [];
  let last = performance.now();
  // anda para um ponto valido
  s.localPlayer?.moveTo(380, 300, 150);
  const loop = (t) => {
    deltas.push(t - last); last = t;
    if (deltas.length < 240) requestAnimationFrame(loop);
    else {
      deltas.sort((a, b) => a - b);
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      res({ avgMs: +avg.toFixed(2), p95Ms: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1), maxMs: +deltas[deltas.length - 1].toFixed(1), fps: +(1000 / avg).toFixed(1) });
    }
  };
  requestAnimationFrame(loop);
}));
console.log('WALK FPS:', JSON.stringify(walkFps));

// ---------- FASE 5: troca de sala (cold de outra sala) ----------
const t2 = Date.now();
await p.evaluate(() => window.__penguin.scene.changeRoom('cafe', 300, 300));
await p.waitForFunction(() => {
  const s = window.__penguin.scene;
  return s.currentRoom === 'cafe' && s._movieReady === true;
}, null, { timeout: 120000 });
console.log('ROOM CHANGE cafe _movieReady em', ((Date.now() - t2) / 1000).toFixed(1) + 's');

// ---------- FASE 6: estado do cache IDB ----------
const idb = await p.evaluate(async () => {
  const dbs = await indexedDB.databases?.() || [];
  return dbs.map(d => d.name);
});
console.log('IDB databases:', JSON.stringify(idb));
await b.close();
