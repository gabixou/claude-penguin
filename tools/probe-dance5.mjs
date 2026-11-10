import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('CON', m.type(), m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(async () => {
  const pg = window.__penguin, v = pg.view;
  const log = [];
  // chama render manual num canvas de teste com frame dance, capturando erros por item
  pg.setAction('dance');
  await new Promise(r => setTimeout(r, 300));
  const af = v.animationFrame;
  const cv = document.createElement('canvas');
  cv.width = pg._canvas.width; cv.height = pg._canvas.height;
  const cx = cv.getContext('2d');
  const b = pg._lib.bounds;
  cx.setTransform(pg.scene._ss, 0, 0, pg.scene._ss, -b.x0 * pg.scene._ss, -b.y0 * pg.scene._ss);
  try { await v.art.draw(cx, af, pg.scene._ss); log.push('art ok af=' + af); }
  catch (e) { log.push('art ERR ' + e.message); }
  for (const [slot, it] of v.items) {
    try { await it.draw(cx, af, pg.scene._ss); log.push(slot + ' ok'); }
    catch (e) { log.push(slot + ' ERR ' + e.message + ' | ' + (e.stack || '').split('\n')[1]); }
  }
  // conta pixels nao-transparentes
  const d = cx.getImageData(0, 0, cv.width, cv.height).data;
  let opaque = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) opaque++;
  return { af, log, opaque, drawnFrame: v.drawnFrame };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
