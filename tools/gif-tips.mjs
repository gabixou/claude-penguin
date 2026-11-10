import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000');
const r = await p.evaluate(async () => {
  const img = new Image();
  img.src = '/assets/ui/loader_arrows.gif';
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
  const pts = [];
  let maxR = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 128) {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
      if (r > maxR) maxR = r;
      pts.push({ x, y, r, a: Math.atan2(dy, dx) });
    }
  }
  // regiao das pontas: pixels com r > 15 (arrowheads estao fora do anel ~13)
  const tips = pts.filter(q => q.r > 15.5);
  const tipInfo = tips.map(q => ({
    x: q.x, y: q.y, r: +q.r.toFixed(1),
    deg: +(((q.a * 180 / Math.PI) + 360) % 360).toFixed(0)
  }));
  // anel: pixels 10<r<15.5 -> extent angular
  const ring = pts.filter(q => q.r > 10 && q.r < 15.5);
  const ringDegs = ring.map(q => ((q.a * 180 / Math.PI) + 360) % 360);
  // gaps: angulos sem pixels do anel
  const has = new Array(360).fill(false);
  ringDegs.forEach(dg => { has[Math.floor(dg)] = true; });
  const gaps = [];
  let start = -1;
  for (let i = 0; i <= 360; i++) {
    const v = has[i % 360];
    if (!v && start < 0) start = i;
    if (v && start >= 0) { gaps.push([start, i - 1]); start = -1; }
  }
  return { maxR: +maxR.toFixed(1), tipCount: tips.length, tips: tipInfo.slice(0, 60), gaps, ringCount: ring.length };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
