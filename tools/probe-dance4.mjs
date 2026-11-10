import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

async function grab(name) {
  const data = await p.evaluate(() => {
    const pg = window.__penguin;
    const src = pg._canvas;
    const cv = document.createElement('canvas');
    cv.width = src.width * 5; cv.height = src.height * 5;
    const cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(src, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/png');
  });
  fs.writeFileSync(`shots/pg-${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(name, 'saved');
}
await grab('idle');
await p.evaluate(() => window.__penguin.setAction('dance'));
await p.waitForTimeout(800);
await grab('dance');
await p.evaluate(() => window.__penguin.setAction('throw'));
await p.waitForTimeout(500);
await grab('throw');
await p.evaluate(() => window.__penguin.setAction('idle'));
await p.waitForTimeout(400);
await grab('idle2');
await b.close();
