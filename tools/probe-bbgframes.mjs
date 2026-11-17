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
    if (!/bitmapbg_mc$|background_mc$/.test(path)) continue;
    out[path] = {
      frames: h.tl.frames.length, cur: h.frame, stopped: h.stopped,
      labels: h.tl.labels,
      perFrame: h.tl.frames.map((fr, i) => fr.length),
    };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
