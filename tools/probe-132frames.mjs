import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene, m = sc.movie;
  const d = (sc._dynList || []).find(x => x.path === '#132');
  const h = m._playhead(d.path, d.sid);
  const orig = h.frame;
  const stats = [];
  for (let f = 1; f <= h.tl.frames.length; f++) {
    h.frame = f;
    await m.renderSpriteDynamic(d, sc._ss);
    const cx = d.canvas.getContext('2d');
    const id = cx.getImageData(0, 0, d.canvas.width, d.canvas.height).data;
    let op = 0, orange = 0, yellow = 0;
    for (let i = 0; i < id.length; i += 16) {
      if (id[i + 3] > 40) {
        op++;
        const R = id[i], G = id[i + 1], B = id[i + 2];
        if (R > 180 && G > 60 && G < 170 && B < 90) orange++;
        if (R > 170 && G > 140 && B < 100) yellow++;
      }
    }
    stats.push({ f, op, orange, yellow });
  }
  h.frame = orig;
  await m.renderSpriteDynamic(d, sc._ss);
  d.tex?.refresh();
  return stats;
});
// imprime so frames com orange/yellow > 0 ou op variando muito
const ops = r.map(s => s.op);
console.log('op min/max:', Math.min(...ops), Math.max(...ops));
for (const s of r) if (s.orange > 5 || s.yellow > 5) console.log(JSON.stringify(s));
console.log('total frames:', r.length);
await b.close();
