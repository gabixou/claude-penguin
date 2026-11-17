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
    const chars = ' .:-=+*#%@';
    const rows = [];
    // card ocupa ~centro; modal tambem. amostra grade 8px
    for (let j = 0; j < img.naturalHeight; j += 12) {
      let row = '';
      for (let i = 0; i < img.naturalWidth; i += 12) {
        const d = x.getImageData(i, j, 12, 12).data;
        const lum = (d[0]*0.3+d[1]*0.6+d[2]*0.1)/255;
        row += chars[Math.min(9, Math.floor(lum*10))];
      }
      rows.push(row);
    }
    res(rows.join('\n'));
  };
  img.src = '/tools/tools/shots/rename-modal.png';
}));
console.log(out);
await b.close();
