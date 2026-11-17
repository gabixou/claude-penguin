import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
await p.waitForTimeout(2000);
const snap = () => p.evaluate(() => {
  const sc = window.__penguin.scene, m = sc.movie;
  return {
    dyns: (sc._dynList || []).map(d => ({
      path: d.path, w: d.canvas?.width, h: d.canvas?.height,
      frame: m._playheads.get(d.path)?.frame,
      stopped: m._playheads.get(d.path)?.stopped,
      visible: d.img?.visible,
    })),
    segs: (sc.movieLayers || []).length,
  };
});
const a = await snap();
await p.waitForTimeout(2000);
const c = await snap();
console.log('T0', JSON.stringify(a, null, 1));
console.log('T1', JSON.stringify(c.dyns.filter(d => d.path === '#132' || d.path.includes('132')), null, 1));
await b.close();
