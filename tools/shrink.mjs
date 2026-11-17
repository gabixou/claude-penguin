import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
for (const [src, dst] of [
  ['tools/shots/clone-boot-loader.png', 'tools/shots/clone-boot-small.png'],
  ['tools/shots/ref-boot-loader.png', 'tools/shots/ref-boot-small.png'],
]) {
  const b64 = fs.readFileSync(src).toString('base64');
  const out = await p.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 640; c.height = Math.round(img.height * 640 / img.width);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, b64);
  fs.writeFileSync(dst, Buffer.from(out.split(',')[1], 'base64'));
  console.log(dst, fs.statSync(dst).size);
}
await b.close();
