import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => {
  const s = window.__penguin?.scene;
  return s?._movieReady === true && s?.localPlayer;
}, null, { timeout: 120000 });
await p.waitForTimeout(3000);

const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const mv = s.movie;
  const out = {};

  // 1) instrumenta renderLayer
  const rlTimes = [];
  const origRL = mv.renderLayer.bind(mv);
  mv.renderLayer = async (...a) => {
    const t = performance.now();
    try { return await origRL(...a); }
    finally { rlTimes.push(performance.now() - t); }
  };
  // 2) instrumenta tick
  const tickTimes = [];
  const origTick = mv.tick.bind(mv);
  mv.tick = () => { const t = performance.now(); try { return origTick(); } finally { tickTimes.push(performance.now() - t); } };

  const fpsSample = (ms) => new Promise((res) => {
    const d = []; let last = performance.now();
    const loop = (t) => { d.push(t - last); last = t; d.length < ms / 16.7 ? requestAnimationFrame(loop) : res(d); };
    requestAnimationFrame(loop);
  });

  // A) baseline 3s
  let d = await fpsSample(3000);
  d.sort((a, b) => a - b);
  out.baseline = { avg: +(d.reduce((x, y) => x + y) / d.length).toFixed(1), p95: +d[Math.floor(d.length * .95)].toFixed(1) };
  out.rlCalls = rlTimes.length;
  const srl = [...rlTimes].sort((a, b) => a - b);
  out.rl = srl.length ? { avg: +(srl.reduce((x, y) => x + y) / srl.length).toFixed(1), max: +srl[srl.length - 1].toFixed(1), totalMs: +srl.reduce((x, y) => x + y).toFixed(0) } : null;
  const stk = [...tickTimes].sort((a, b) => a - b);
  out.tick = stk.length ? { avg: +(stk.reduce((x, y) => x + y) / stk.length).toFixed(2), max: +stk[stk.length - 1].toFixed(2) } : null;

  // B) sem movieTimer (para de animar layers)
  rlTimes.length = 0; tickTimes.length = 0;
  s.movieTimer?.remove();
  d = await fpsSample(3000);
  d.sort((a, b) => a - b);
  out.noTimer = { avg: +(d.reduce((x, y) => x + y) / d.length).toFixed(1), p95: +d[Math.floor(d.length * .95)].toFixed(1) };
  out.rlCallsAfter = rlTimes.length;

  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
