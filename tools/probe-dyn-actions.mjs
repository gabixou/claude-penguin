import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const res = await p.evaluate(() => {
  const s = window.__penguin.scene, m = s.movie;
  const out = {};
  for (const d of s._dynList || []) {
    const h = m._playheads.get(d.path) || [...m._playheads.entries()].find(([k]) => k === d.path || k.endsWith('.' + d.path))?.[1];
    const tl = m.sprites[d.sid];
    out[d.sid] = {
      path: d.path,
      frame: h?.frame, stopped: h?.stopped,
      actions: tl?.frames?.slice(0, 6).map((f, i) => m._actions(tl, i + 1)),
      nFrames: tl?.frames?.length,
    };
  }
  return out;
});
console.log(JSON.stringify(res, null, 1).slice(0, 7000));
await b.close();
