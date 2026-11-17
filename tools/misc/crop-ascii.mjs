import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/').catch(() => {});
await p.setContent('<html><body></body></html>');
const regions = await p.evaluate(() => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const out = [];
    const chars = ' .:-=+*#%@';
    for (const [rx, ry, rw, rh] of [[690, 460, 100, 90], [1460, 740, 60, 100]]) {
      const rows = [];
      for (let j = 0; j < rh; j += 3) {
        let row = '';
        for (let i = 0; i < rw; i += 2) {
          const d = x.getImageData(rx + i, ry + j, 2, 3).data;
          const lum = (d[0] * 0.3 + d[1] * 0.6 + d[2] * 0.1) / 255;
          row += chars[Math.min(9, Math.floor(lum * 10))];
        }
        rows.push(row);
      }
      out.push(rows.join('\n'));
    }
    res(out.join('\n===REGION2===\n'));
  };
  img.src = '/_shot.png';
}));
console.log(regions);
await b.close();
