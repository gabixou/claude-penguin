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
  const W = c.width, H = c.height;
  // pixels brancos (alpha>128): radius e angulo
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 128) {
      const dx = x - W / 2, dy = y - H / 2;
      pts.push({ x, y, r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) });
    }
  }
  // histograma de radius
  const rh = {};
  pts.forEach(q => { const k = Math.round(q.r); rh[k] = (rh[k] || 0) + 1; });
  const radii = Object.entries(rh).map(([r, n]) => [+r, n]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  // cobertura angular: para cada angulo (deg), min/max radius -> detecta gaps
  const cov = new Array(72).fill(0);
  pts.forEach(q => {
    const deg = Math.floor(((q.a * 180 / Math.PI) + 360) % 360 / 5);
    cov[deg]++;
  });
  return { W, H, n: pts.length, radii, cov, pts: pts.filter((_, i) => i % 7 === 0).map(q => [q.x, q.y]) };
});
console.log(JSON.stringify(r, null, 1).slice(0, 4000));
await b.close();
