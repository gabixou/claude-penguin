import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/').catch(()=>{}); await p.setContent('<html><body></body></html>');
const px = await p.evaluate(() => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const W = img.naturalWidth, H = img.naturalHeight, cell = 40;
    const dark = [];
    for (let gy = 0; gy < H; gy += cell) for (let gx = 0; gx < W; gx += cell) {
      const d = x.getImageData(gx, gy, Math.min(cell, W - gx), Math.min(cell, H - gy)).data;
      let n = 0, tot = 0;
      for (let i = 0; i < d.length; i += 4) { tot++; if (d[i] < 25 && d[i+1] < 25 && d[i+2] < 25) n++; }
      if (n / tot > 0.85) dark.push([gx, gy]);
    }
    res({ size: [W, H], darkCells: dark.length, sample: dark.slice(0, 30) });
  };
  img.src = '/_shot.png';
}));
console.log(JSON.stringify(px));
await b.close();
