import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const m = window.__penguin.scene.movie;
  const out = {};
  for (const [path, h] of (m._playheads || new Map()).entries()) {
    if (!/nightclubsign|giftshopsign|coffeeshop_mc$|#132$|canopy/.test(path)) continue;
    if (!h.tl?.frames) continue;
    out[path.split('.').pop()] = {
      stopped: h.stopped, frame: h.frame,
      acts: h.tl.frames.map((fr, i) => ({ f: i + 1, a: m._actions(h.tl, i + 1) })),
      // labels
      labels: h.tl.labels || null,
    };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
