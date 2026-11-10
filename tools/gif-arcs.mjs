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
  // bins de 10 graus: conta pixels do anel (r 9..16)
  const bins = new Array(36).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 128) {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
      if (r >= 8 && r <= 16.5) {
        const a = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        bins[Math.floor(a / 10)]++;
      }
    }
  }
  return bins;
});
console.log(r.map((v, i) => (i * 10) + '°:' + v).join(' '));
await b.close();
