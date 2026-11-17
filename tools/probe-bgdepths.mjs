import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const m = window.__penguin.scene.movie;
  // pega o playhead de bitmapbg_mc e lista entries do frame atual
  const h = m._playheads.get('background_mc.bitmapbg_mc');
  if (!h) return { err: 'no playhead', keys: [...(m._playheads?.keys()||[])].filter(k=>k.includes('bitmapbg')) };
  const fr = h.tl.frames[h.frame - 1] || h.tl.frames[0] || [];
  return fr.map((e, i) => ({ i, id: e.id, name: e.name || '', depth: e.depth, clip: e.clipDepth }));
});
console.log(JSON.stringify(r, null, 0));
await b.close();
