import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const t0 = Date.now();
await p.goto('https://gopenguin.lol/', { waitUntil: 'domcontentloaded', timeout: 60000 });
// detecta quando o canvas principal tem conteudo nao-trivial (sala desenhada)
let firstContent = -1;
for (let i = 0; i < 120; i++) {
  const info = await p.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')];
    let best = { score: 0, w: 0, h: 0 };
    for (const c of cs) {
      try {
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let nz = 0;
        for (let j = 3; j < d.length; j += 40) if (d[j] > 0) nz++;
        const score = nz / (d.length / 40);
        if (score > best.score) best = { score, w: c.width, h: c.height };
      } catch {}
    }
    return best;
  }).catch(() => null);
  if (info && info.score > 0.05 && firstContent < 0) {
    firstContent = Date.now() - t0;
    console.log('FIRST CONTENT at', (firstContent / 1000).toFixed(1) + 's', JSON.stringify(info));
  }
  if (firstContent > 0 && Date.now() - t0 > firstContent + 3000) break;
  await p.waitForTimeout(400);
}
// FPS via rAF por 3s
const fps = await p.evaluate(() => new Promise((res) => {
  const deltas = [];
  let last = performance.now();
  const loop = (t) => {
    deltas.push(t - last); last = t;
    if (deltas.length < 180) requestAnimationFrame(loop);
    else {
      deltas.sort((a, b) => a - b);
      const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      res({ avgMs: +avg.toFixed(2), p95: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1), fps: +(1000 / avg).toFixed(1) });
    }
  };
  requestAnimationFrame(loop);
}));
console.log('FPS', JSON.stringify(fps));
// estado da UI
const st = await p.evaluate(() => ({
  text: document.body?.innerText?.slice(0, 200),
}));
console.log('STATE', JSON.stringify(st));
await b.close();
