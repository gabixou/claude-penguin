import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(4000); // deixa o warm-up terminar
const r = await p.evaluate(async () => {
  const pg = window.__penguin;
  const times = [];
  const orig = pg.view.render.bind(pg.view);
  pg.view.render = async (...a) => { const t = performance.now(); try { return await orig(...a); } finally { times.push(performance.now() - t); } };
  const measure = async (act, ms) => {
    pg.setAction(act);
    times.length = 0;
    await new Promise(r => setTimeout(r, ms));
    const s = [...times].sort((a, b) => a - b);
    return { n: s.length, avg: +(s.reduce((a,b)=>a+b,0)/s.length).toFixed(1), p95: +s[Math.floor(s.length*0.95)].toFixed(1), max: +s[s.length-1].toFixed(1) };
  };
  const idle = await measure('idle', 2000);
  const dance = await measure('dance', 2000);
  const thr = await measure('throw', 2000);
  const walk = await measure('walk', 2000);
  return { idle, dance, thr, walk };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
