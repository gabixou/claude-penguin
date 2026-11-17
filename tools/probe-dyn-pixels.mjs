import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500); // deixa animar alguns frames
const res = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return (s._dynList || []).map((d, i) => {
    if (!d.canvas) return { i, path: d.path, canvas: false };
    const ctx = d.canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
    let alpha = 0;
    for (let k = 3; k < data.length; k += 4) if (data[k] > 10) alpha++;
    const img = d.img;
    return {
      i, path: d.path, sid: d.sid,
      w: d.canvas.width, h: d.canvas.height,
      alphaPx: alpha,
      imgVisible: img?.visible, imgAlpha: img?.alpha,
      imgXY: img ? [+img.x.toFixed(1), +img.y.toFixed(1)] : null,
      imgSize: img ? [+img.displayWidth.toFixed(1), +img.displayHeight.toFixed(1)] : null,
      depth: img?.depth,
    };
  });
});
for (const r of res) console.log(JSON.stringify(r));
await b.close();
