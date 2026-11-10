import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

// info do estado
const info = await p.evaluate(() => {
  const pg = window.__penguin;
  const v = pg.view;
  return {
    room: pg.scene.currentRoom,
    action: pg.action,
    frame: v.frame,
    af: v.animationFrame,
    drawnFrame: v.drawnFrame,
    look: v.look,
    items: [...v.items.entries()].map(([s, c]) => [s, c.m.data.main.frames.length]),
    ss: pg.scene._ss,
    canvas: [pg._canvas.width, pg._canvas.height],
  };
});
console.log('INFO', JSON.stringify(info));

// screenshot da regiao do pinguim — pega o canvas do sprite
async function shot(name) {
  const box = await p.evaluate(() => {
    const pg = window.__penguin;
    const r = pg.sprite.getBounds();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  // expande um pouco
  const clip = { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.w + 20, height: box.h + 20 };
  await p.screenshot({ path: `shots/dance-${name}.png`, clip });
  console.log(name, JSON.stringify(clip));
}

await shot('idle');
await p.evaluate(() => { window.__penguin.setAction('dance'); });
await p.waitForTimeout(700);
const d1 = await p.evaluate(() => { const v = window.__penguin.view; return { af: v.animationFrame, drawn: v.drawnFrame, action: window.__penguin.action }; });
console.log('DANCE1', JSON.stringify(d1));
await shot('dance1');
await p.waitForTimeout(700);
await shot('dance2');
await p.evaluate(() => { window.__penguin.setAction('idle'); });
await p.waitForTimeout(500);
await shot('idle2');
// throw
await p.evaluate(() => { window.__penguin.setAction('throw'); });
await p.waitForTimeout(400);
await shot('throw');
console.log('ERRS', errs.slice(0, 5));
await b.close();
