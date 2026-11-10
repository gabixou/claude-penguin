import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
const b64 = fs.readFileSync('tools/shots/clone-loader-new.png').toString('base64');
// crop regiao do spinner (centro ~380,205 em mundo 760x480; screenshot 1280x800 letterboxed)
const out = await p.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  // assume canvas 1280x800 com mundo 760x480 -> escala ~1.68, offset central
  const c = document.createElement('canvas');
  c.width = 400; c.height = 300;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}, b64);
fs.writeFileSync('tools/shots/loader-crop.png', Buffer.from(out.split(',')[1], 'base64'));
await b.close();
