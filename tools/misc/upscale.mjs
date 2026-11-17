import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const b64 = fs.readFileSync('tools/shots/gif-frame-0.png').toString('base64');
const out = await p.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = 440; c.height = 440;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d4983'; ctx.fillRect(0, 0, 440, 440);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, 440, 440);
  return c.toDataURL('image/png');
}, b64);
fs.writeFileSync('tools/shots/gif-frame-big.png', Buffer.from(out.split(',')[1], 'base64'));
await b.close();
