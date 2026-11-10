import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000');
const frames = await p.evaluate(async () => {
  const img = new Image();
  img.src = '/assets/ui/loader_arrows.gif';
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const out = [];
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0, sx = 0, sy = 0;
    const buckets = new Array(36).fill(0);
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const a = d[(y * c.width + x) * 4 + 3];
      if (a > 128) {
        n++; sx += x; sy += y;
        const ang = Math.atan2(y - c.height / 2, x - c.width / 2);
        buckets[Math.floor(((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 36)]++;
      }
    }
    const sig = n + ':' + buckets.join(',');
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push({ i, n, cx: +(sx / n).toFixed(1), cy: +(sy / n).toFixed(1), png: c.toDataURL('image/png') });
    }
    await new Promise(r => setTimeout(r, 60));
  }
  return out;
});
frames.forEach((f, i) => fs.writeFileSync('tools/shots/gif-frame-' + i + '.png', Buffer.from(f.png.split(',')[1], 'base64')));
console.log('frames unicos:', frames.length);
console.log(JSON.stringify(frames.map(f => ({ i: f.i, n: f.n, cx: f.cx, cy: f.cy }))));
await b.close();
