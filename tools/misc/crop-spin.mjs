import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
// recarrega loader e captura spinner isolado do nosso LoadingScreen via evaluate no Phaser
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(250);
  const st = await p.evaluate(() => {
    const s = window.__game?.scene?.getScene('RoomScene');
    return s?.loadingScreen?.visible ? true : false;
  }).catch(() => false);
  if (st) break;
}
await p.waitForTimeout(400);
// crop da regiao do spinner: mundo (380,205) -> canvas 1267x800 offset x~6
const { data } = await (await p.context().newCDPSession(p)).send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('tools/shots/loader-full.png', Buffer.from(data, 'base64'));
// crop via canvas: spinner ~ (639,342) na tela
const b64 = fs.readFileSync('tools/shots/loader-full.png').toString('base64');
const out = await p.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = 200; c.height = 200;
  c.getContext('2d').drawImage(img, 540, 245, 200, 200, 0, 0, 200, 200);
  c.getContext('2d').imageSmoothingEnabled = true;
  return c.toDataURL('image/png');
}, b64);
fs.writeFileSync('tools/shots/our-spin.png', Buffer.from(out.split(',')[1], 'base64'));
await b.close();
