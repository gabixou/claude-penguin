import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
// loading screen deve aparecer logo apos open()
const loadingSeen = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const pr = sc.catalogue.open('clothing');
  const t0 = performance.now();
  let seen = false;
  while (performance.now() - t0 < 30000) {
    if (sc.loadingScreen?.visible) { seen = true; break; }
    await new Promise(r => setTimeout(r, 30));
  }
  await pr;
  return seen;
});
console.log('loadingScreen visivel durante open:', loadingSeen);
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(2500);
// screenshot + contagem de pixels coloridos na area do livro
const r = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  const ctx = c.canvas.getContext('2d');
  const W = c.canvas.width, H = c.canvas.height;
  const stats = (x0, y0, w, h) => {
    const d = ctx.getImageData(x0, y0, w, h).data; let n = 0, col = 0;
    for (let i = 0; i < d.length; i += 16) { if (d[i + 3] > 100) { n++; if (!(d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) col++; } }
    return Math.round(100 * col / n);
  };
  return { left: stats(0.30 * W, 0.22 * H, 0.20 * W, 0.55 * H), right: stats(0.52 * W, 0.22 * H, 0.18 * W, 0.55 * H) };
});
console.log('cover pixels:', JSON.stringify(r), '(gp ref: left~96 right~98)');
await p.screenshot({ path: 'shots/cover-fixed.png' });
await b.close();
