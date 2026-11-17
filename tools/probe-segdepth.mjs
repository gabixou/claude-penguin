import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const info = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const out = [];
  // regiao do letreiro: img ~(389,81) canvas 346x123 em device px; screen = device/ss
  const ss = sc._ss;
  for (const s of (sc._segments || [])) {
    const img = s.img;
    if (!img) continue;
    // bounds do segmento na tela (world coords -> img.x/y e tamanho do canvas/ss)
    const x0 = img.x, y0 = img.y;
    const w = s.canvas.width / ss, h = s.canvas.height / ss;
    out.push({ depth: +s.depth.toFixed(5), x: Math.round(x0), y: Math.round(y0), w: Math.round(w), h: Math.round(h), ops: s.ops.length });
  }
  // dynamics tb
  for (const d of (sc._dynList || [])) {
    const img = d.img; if (!img) continue;
    out.push({ depth: +d.depth.toFixed(5), x: Math.round(img.x), y: Math.round(img.y), w: Math.round(d.canvas.width / ss), h: Math.round(d.canvas.height / ss), dyn: d.path });
  }
  out.sort((a, b) => a.depth - b.depth);
  return out;
});
for (const s of info) console.log(JSON.stringify(s));
await b.close();
