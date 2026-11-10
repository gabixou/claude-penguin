import fs from 'fs';
import zlib from 'zlib';
// decode PNG via playwright? use canvas no browser — parse PNG manual eh chato.
// Alternativa: chromium evaluate load image
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const stats = await p.evaluate(async () => {
  const img = new Image();
  img.src = 'file:///E:/project/club-penguin-browser/tools/tools/shots/card-photo.png';
  await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  const colors = new Set(); let n = 0;
  for (let i = 0; i < d.length; i += 16) { // amostra 1/4 px
    if (d[i+3] > 100) { n++; colors.add((d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4)); }
  }
  return { w: c.width, h: c.height, samples: n, unique: colors.size };
});
console.log(JSON.stringify(stats));
await b.close();
