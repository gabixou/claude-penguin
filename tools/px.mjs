import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/').catch(() => {});
await p.setContent('<html><body></body></html>');
const out = await p.evaluate(() => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const pts = [];
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const px = x.getImageData(420 + i * 18, 660 + j * 12, 1, 1).data;
      pts.push(px[0] + ',' + px[1] + ',' + px[2]);
    }
    res(pts.join(' | '));
  };
  img.src = '/_shot.png';
}));
console.log(out);
await b.close();
