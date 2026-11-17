import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
for (let i = 0; i < 8; i++) {
  const r = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const res = {};
    for (const d of (sc._dynList || [])) {
      if (!d.path.includes('nightclubsign')) continue;
      const c = d.canvas; const cx = c.getContext('2d');
      const id = cx.getImageData(0, 0, c.width, c.height).data;
      let op = 0, bright = 0;
      for (let j = 0; j < id.length; j += 16) { // sample every 4th px
        if (id[j + 3] > 10) { op++; if (id[j] + id[j+1] + id[j+2] > 400) bright++; }
      }
      res[d.path.split('.').pop()] = { op, bright, frame: d.movie?._playheads ? '?' : '?' };
    }
    return res;
  });
  console.log(i, JSON.stringify(r));
  await p.waitForTimeout(600);
}
await b.close();
