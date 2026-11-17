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
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  const pc = sc.playerCard;
  const movie = await pc._movie();
  await pc._build(movie, sc.localPlayer);
  await new Promise(r => setTimeout(r, 3000));
  // acha o canvas do card
  const keys = Object.keys(sc.textures.list).filter(k => k.startsWith('playercard_'));
  const tex = sc.textures.get(keys[0]);
  const src = tex.getSourceImage();
  const snap = () => {
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  };
  const withPhoto = snap();
  // remove photo e repinta
  const pg = sc.localPlayer;
  const old = pg.gpaOutfit.photo;
  pg.gpaOutfit.photo = null;
  await pc._repaint();
  await new Promise(r => setTimeout(r, 500));
  const noPhoto = snap();
  pg.gpaOutfit.photo = old;
  await pc._repaint();
  // diff: bounding box dos pixels alterados (em px do canvas)
  const W = src.width, H = src.height;
  let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (Math.abs(withPhoto[i] - noPhoto[i]) + Math.abs(withPhoto[i+1] - noPhoto[i+1]) + Math.abs(withPhoto[i+2] - noPhoto[i+2]) > 30) {
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return { canvas: [W, H], diffPx: n, bbox: n ? [x0, y0, x1, y1] : null };
});
console.log(JSON.stringify(r));
await b.close();
