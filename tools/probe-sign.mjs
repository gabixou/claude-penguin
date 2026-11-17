import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const out = { dyns: [], segs: sc._segments?.length };
  for (const d of (sc._dynList || [])) {
    const c = d.canvas;
    let opaque = 0;
    if (c) {
      const cx = c.getContext('2d');
      const id = cx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < id.length; i += 4) if (id[i] > 10) opaque++;
    }
    out.dyns.push({ path: d.path, depth: d.depth, img: d.img ? [Math.round(d.img.x), Math.round(d.img.y)] : null, canvas: c ? [c.width, c.height] : null, opaque });
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await b.close();
