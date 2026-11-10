import { chromium } from 'playwright-core';
import fs from 'fs';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(20000);
const r = await p.evaluate(() => {
  const pg = window.__penguin;
  const v = pg && pg.view;
  if (!v || !v.canvas) return { err: 'no view/canvas' };
  const c = v.canvas;
  const off = document.createElement('canvas');
  off.width = c.width; off.height = c.height;
  const ctx = off.getContext('2d');
  ctx.drawImage(c, 0, 0);
  return { w: c.width, h: c.height, url: off.toDataURL('image/png').slice(0, 100),
           full: off.toDataURL('image/png') };
});
if (r.full) {
  fs.writeFileSync('tools/shots/penguin-view.png', Buffer.from(r.full.split(',')[1], 'base64'));
  console.log('saved', r.w, 'x', r.h);
} else console.log(JSON.stringify(r));
// also grab scene info
const info = await p.evaluate(() => {
  const pg = window.__penguin;
  const v = pg.view;
  return { frame: v.frame, items: [...v.items.keys()],
           bounds: v.bounds ? { x0: v.bounds.x0, y0: v.bounds.y0, x1: v.bounds.x1, y1: v.bounds.y1 } : null,
           color: pg.color, action: pg.action, dir: pg.direction };
});
console.log(JSON.stringify(info));
await b.close();
