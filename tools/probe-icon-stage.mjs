import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const MR = s.movie.constructor;
  const out = {};
  for (const id of [402, 431, 408]) {
    try {
      const pm = await MR.load('/assets/icons/' + id);
      const W = pm.stage?.width || 100, H = pm.stage?.height || 100;
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(W * scale); canvas.height = Math.ceil(H * scale);
      await pm.renderFrame(0, canvas, scale);
      const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (d[(y * canvas.width + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      out[id] = {
        stage: [W, H], canvas: [canvas.width, canvas.height],
        stageBBox: [x0 / scale, y0 / scale, x1 / scale, y1 / scale].map(v => +v.toFixed(1)),
        touchEdge: x0 === 0 || y0 === 0 || x1 === canvas.width - 1 || y1 === canvas.height - 1,
        frameEntries: JSON.stringify((pm._mainTl.frames[0] || []).map(e => ({ n: e.name, id: e.id, m: e.matrix }))).slice(0, 400),
      };
    } catch (e) { out[id] = 'ERR ' + e.message; }
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
