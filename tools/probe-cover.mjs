import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.catalogue?.open('clothing'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const m = window.__penguin.scene.catalogue.movie;
  m.goto('book', 1);
  const frame = m._mainTl.frames[0];
  const scale = 2, W = 760 * scale, H = 480 * scale;
  const IDENT = { a: scale, b: 0, c: 0, d: scale, x: 0, y: 0 };
  const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
  const out = [];
  for (const e of frame) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const t0 = performance.now();
    try {
      if (e.clipDepth !== undefined) {
        const masked = []; let i = frame.indexOf(e);
        // replicar coleta
        let j = i; const masked2 = [];
        while (j + 1 < frame.length && frame[j + 1].depth <= e.clipDepth) masked2.push(frame[++j]);
        await m._drawMasked(ctx, e, masked2, IDENT, '', IDENT_COLOR, scale, 1);
      } else {
        await m._drawEntry(ctx, e, IDENT, '', IDENT_COLOR, scale, 1);
      }
    } catch (err) { out.push({ id: e.id, name: e.name, err: String(err) }); continue; }
    const d = ctx.getImageData(0, 0, W, H).data;
    let px = 0, nonwhite = 0;
    for (let i = 0; i < d.length; i += 16) { if (d[i + 3] > 100) { px++; if (!(d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235)) nonwhite++; } }
    out.push({ id: e.id, name: e.name, depth: e.depth, clip: e.clipDepth, ms: Math.round(performance.now() - t0), px, nonwhite });
  }
  return out;
});
for (const o of r) console.log(JSON.stringify(o));
await b.close();
