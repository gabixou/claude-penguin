import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
for (const f of process.argv.slice(2)) {
  const b64 = fs.readFileSync(f).toString('base64');
  const r = await p.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    const W = cv.width, H = cv.height;
    let g = 0, n = 0;
    const lum = (x, y) => { const i = (y * W + x) * 4; return d[i] + d[i + 1] + d[i + 2]; };
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (d[(y * W + x) * 4 + 3] < 40) continue;
      g += Math.abs(lum(x, y) - lum(x - 1, y)) + Math.abs(lum(x, y) - lum(x, y - 1)); n++;
    }
    return { energy: +(g / Math.max(1, n)).toFixed(2), px: n };
  }, b64);
  console.log(f.split('/').pop(), JSON.stringify(r));
}
await b.close();
