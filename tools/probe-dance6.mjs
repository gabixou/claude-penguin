import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

// estatisticas do canvas interno em varios instantes
async function stats(tag) {
  return p.evaluate(() => {
    const pg = window.__penguin;
    const cx = pg._canvas.getContext('2d');
    const d = cx.getImageData(0, 0, pg._canvas.width, pg._canvas.height).data;
    let opaque = 0, colored = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40) {
        opaque++;
        // nao-amarelo (roupa tem varias cores); amarelo penguin ~ (255,204,0)?
        const r = d[i], g = d[i+1], bl = d[i+2];
        if (!(r > 180 && g > 140 && bl < 120)) colored++;
      }
    }
    return { opaque, colored, af: pg.view.animationFrame, drawn: pg.view.drawnFrame, rendering: pg._rendering };
  });
}
console.log('idle:', JSON.stringify(await stats()));
await p.evaluate(() => window.__penguin.setAction('dance'));
for (let i = 0; i < 6; i++) {
  await p.waitForTimeout(300);
  console.log('dance t+' + (i+1)*300 + ':', JSON.stringify(await stats()));
}
// grab para gemini
const grab = async (name) => p.evaluate(() => {
  const pg = window.__penguin;
  const cv = document.createElement('canvas');
  cv.width = pg._canvas.width * 5; cv.height = pg._canvas.height * 5;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = false;
  cx.drawImage(pg._canvas, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/png');
}).then(d => fs.writeFileSync(`shots/pg2-${name}.png`, Buffer.from(d.split(',')[1], 'base64')));
await grab('dance-warm');
await p.evaluate(() => window.__penguin.setAction('idle'));
await p.waitForTimeout(500);
await grab('idle-warm');
await b.close();
