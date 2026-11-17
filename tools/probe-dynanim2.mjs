import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const mv = s.movie;
  // frame atual dos playheads dinamicos
  const framesOf = () => (s._dynList || []).map(d => {
    const h = mv._playheadAll.get(d.path + '\0' + d.sid) || mv._playheads.get(d.path);
    return { path: d.path.split('.').pop() || d.path, frame: h?.frame, stopped: h?.stopped };
  });
  const f1 = framesOf();
  await new Promise(r => setTimeout(r, 800));
  const f2 = framesOf();
  // diff real de pixels num overlay (amostra densa)
  const d0 = (s._dynList || []).find(d => d.canvas && d.canvas.width > 200);
  let pxDiff = null;
  if (d0) {
    const c = d0.canvas, ctx = c.getContext('2d');
    const snap = () => ctx.getImageData(0, 0, c.width, c.height).data;
    const a = snap();
    await new Promise(r => setTimeout(r, 500));
    const bb = snap();
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== bb[i] || a[i+1] !== bb[i+1] || a[i+2] !== bb[i+2] || a[i+3] !== bb[i+3]) diff++;
    pxDiff = { path: d0.path, w: c.width, h: c.height, changedPx: diff, totalPx: c.width * c.height };
  }
  return { f1, f2, pxDiff };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
