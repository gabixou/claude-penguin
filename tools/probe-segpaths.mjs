import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const ss = sc._ss;
  return (sc._segments || []).map((s, i) => {
    const img = s.img; if (!img) return null;
    // bounds mundo do segmento
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const op of s.ops) {
      const m = op.matrix;
      const dev = { a: ss*m.a, b: ss*m.b, c: ss*m.c, d: ss*m.d, x: ss*m.x, y: ss*m.y };
      const bb = sc.movie._boundsOfEntries(op.entries, dev, op.path);
      if (bb) { x0 = Math.min(x0, bb[0]/ss); y0 = Math.min(y0, bb[1]/ss); x1 = Math.max(x1, bb[2]/ss); y1 = Math.max(y1, bb[3]/ss); }
    }
    return {
      i, depth: +s.depth.toFixed(5),
      bb: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)],
      paths: [...(s.paths||[])].slice(0, 8),
      nops: s.ops.length,
    };
  }).filter(Boolean).sort((a,b)=>a.depth-b.depth);
});
for (const s of r) console.log(JSON.stringify(s));
await b.close();
