import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

// mede resolucao efetiva: canvas px por device px para shapes com |world|>1
const eff = await p.evaluate(async () => {
  const pg = window.__penguin, v = pg.view;
  const clips = [v.art, ...v.items.values()];
  const samples = [];
  for (const c of clips) {
    const orig = c.m.artCanvas.bind(c.m);
    c.m.artCanvas = async (file, ch, scale) => {
      const cv = await orig(file, ch, scale);
      if (cv) samples.push({ file, scale: +scale.toFixed(2) });
      return cv;
    };
  }
  pg.setAction('throw');
  await new Promise(r => setTimeout(r, 600));
  pg.setAction('idle');
  await new Promise(r => setTimeout(r, 300));
  const uniq = [...new Set(samples.map(s => s.scale))].sort((a, b) => a - b);
  return { scalesUsed: uniq, max: Math.max(...samples.map(s => s.scale)) };
});
console.log('EFF', JSON.stringify(eff));

const grab = async (name) => p.evaluate(() => {
  const pg = window.__penguin;
  const cv = document.createElement('canvas');
  cv.width = pg._canvas.width * 5; cv.height = pg._canvas.height * 5;
  const cx = cv.getContext('2d');
  cx.imageSmoothingEnabled = false;
  cx.drawImage(pg._canvas, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/png');
}).then(d => fs.writeFileSync(`shots/pg3-${name}.png`, Buffer.from(d.split(',')[1], 'base64')));

// throw com warm + dance
await p.evaluate(() => window.__penguin.setAction('throw'));
await p.waitForTimeout(900);
await grab('throw');
await p.evaluate(() => window.__penguin.setAction('dance'));
await p.waitForTimeout(900);
await grab('dance');
await p.evaluate(() => window.__penguin.setAction('idle'));
await p.waitForTimeout(400);
await grab('idle');
await b.close();
