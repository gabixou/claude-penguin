import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/_blank.html').catch(() => {});
await p.setContent('<html><body></body></html>');
const px = await p.evaluate(() => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const grab = (x0, y0, w, h) => {
      const d = x.getImageData(x0, y0, w, h).data;
      const s = new Set();
      for (let i = 0; i < d.length; i += 16) s.add(d[i] + ',' + d[i+1] + ',' + d[i+2]);
      return [...s].slice(0, 6).join(' | ');
    };
    res({
      topo: grab(0, 0, img.naturalWidth, 40),
      base: grab(0, img.naturalHeight - 40, img.naturalWidth, 40),
      esq: grab(0, 0, 40, img.naturalHeight),
      dir: grab(img.naturalWidth - 40, 0, 40, img.naturalHeight),
      centro: grab(img.naturalWidth/2-50, img.naturalHeight/2-50, 100, 100),
    });
  };
  img.onerror = e => res({ err: 'load fail' });
  img.src = '/_shot.png';
}));
console.log(JSON.stringify(px, null, 1));
await b.close();
