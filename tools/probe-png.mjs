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
    const colors = {};
    let opaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      opaque++;
      const key = `${d[i] >> 4},${d[i+1] >> 4},${d[i+2] >> 4}`;
      colors[key] = (colors[key] || 0) + 1;
    }
    const top = Object.entries(colors).sort((a, b2) => b2[1] - a[1]).slice(0, 8);
    return { opaque, top };
  }, b64);
  console.log(f.split('/').pop(), JSON.stringify(r));
}
await b.close();
