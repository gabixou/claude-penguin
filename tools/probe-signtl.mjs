import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
for (let i = 0; i < 4; i++) {
  const r = await p.evaluate(() => {
    const m = window.__penguin.scene.movie;
    const res = {};
    for (const [k, h] of (m._playheads || new Map()).entries()) {
      if (/nightclubsign|giftshopsign|coffeeshop|#132|canopy/.test(k))
        res[k] = { f: h.frame, n: h.tl?.frames?.length };
    }
    return res;
  });
  console.log(i, JSON.stringify(r));
  await p.waitForTimeout(800);
}
await b.close();
