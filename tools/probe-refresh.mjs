import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => {
  const s = window.__penguin?.scene;
  return s?._movieReady === true && s?.localPlayer;
}, null, { timeout: 120000 });
await p.waitForTimeout(4000); // warm-up idle termina

const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const out = {};
  out.ss = s._ss;
  out.canvasSize = [s.game.canvas.width, s.game.canvas.height];
  out.renderer = s.game.renderer.type; // 1=CANVAS 2=WEBGL

  // instrumenta tex.refresh das layers
  const refTimes = [];
  for (const l of s.movieLayers) {
    const orig = l.tex.refresh.bind(l.tex);
    l.tex.refresh = () => { const t = performance.now(); try { return orig(); } finally { refTimes.push(performance.now() - t); } };
  }
  // tambem refresh do pinguim
  if (s.localPlayer?._texKey && s.textures.exists(s.localPlayer._texKey)) {
    const t = s.textures.get(s.localPlayer._texKey);
    const orig = t.refresh.bind(t);
    t.refresh = () => { const tt = performance.now(); try { return orig(); } finally { refTimes.push(performance.now() - tt); } };
  }

  const fpsSample = (ms) => new Promise((res) => {
    const d = []; let last = performance.now();
    const loop = (t) => { d.push(t - last); last = t; d.length < ms / 16.7 ? requestAnimationFrame(loop) : res(d); };
    requestAnimationFrame(loop);
  });
  const stats = (d) => { d.sort((a, b) => a - b); return { avg: +(d.reduce((x, y) => x + y) / d.length).toFixed(1), p95: +d[Math.floor(d.length * .95)].toFixed(1) }; };

  // 3s idle
  let d = await fpsSample(3000);
  out.idle = stats(d);
  out.refreshCalls = refTimes.length;
  const sr = [...refTimes].sort((a, b) => a - b);
  out.refresh = sr.length ? { avg: +(sr.reduce((x, y) => x + y) / sr.length).toFixed(2), max: +sr[sr.length - 1].toFixed(2), totalMs: +sr.reduce((x, y) => x + y).toFixed(0) } : null;

  // anda 3s
  s.localPlayer?.moveTo(500, 350, 150);
  refTimes.length = 0;
  d = await fpsSample(3000);
  out.walk = stats(d);
  out.refreshCallsWalk = refTimes.length;

  // mede o custo de UM refresh de layer isolado
  const l = s.movieLayers.find(x => x._busy === false) || s.movieLayers[0];
  const t0 = performance.now();
  l.tex.refresh();
  out.singleRefreshMs = +(performance.now() - t0).toFixed(2);
  out.layerCanvas = [l.canvas.width, l.canvas.height];

  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
