import { chromium } from 'playwright-core';
const GAME = process.argv[2] || 'beans';
const ROOM = GAME === 'beans' ? 'coffee' : 'pizza';
const KEY = GAME === 'beans' ? 'beans' : 'pizzatron';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=' + ROOM + '&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate((g) => window.__penguin.scene._showGameUnavailable(g), KEY);
await p.waitForTimeout(15000);
// clica start-button dentro do game doc
await p.evaluate(() => {
  function findGameDoc(doc) {
    for (const f of doc.querySelectorAll('iframe')) {
      try {
        const w = f.contentWindow;
        if (w && w.app && w.document && w.document.querySelector('.game')) return w;
        const r = w && w.document ? findGameDoc(w.document) : null;
        if (r) return r;
      } catch (e) {}
    }
    return null;
  }
  const w = findGameDoc(document);
  if (w) {
    const btn = w.document.querySelector('.start-button');
    if (btn) btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    else w.document.body.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  }
});
await p.waitForTimeout(8000);
const res = await p.evaluate(() => {
  function findGameDoc(doc) {
    for (const f of doc.querySelectorAll('iframe')) {
      try {
        const w = f.contentWindow;
        if (w && w.app && w.document && w.document.querySelector('.game')) return w;
        const r = w && w.document ? findGameDoc(w.document) : null;
        if (r) return r;
      } catch (e) {}
    }
    return null;
  }
  const w = findGameDoc(document);
  if (!w) return { err: 'no game doc' };
  const d = w.document;
  return new Promise((resolve) => {
    let c = 0; const t0 = performance.now();
    const tick = () => { c++; if (performance.now() - t0 < 3000) w.requestAnimationFrame(tick); else {
      resolve({
        state: w.app.currentState(),
        hazards: d.querySelectorAll('.hazard').length,
        conveyors: d.querySelectorAll('.conveyor').length,
        dropped: d.querySelectorAll('.dropped').length,
        pizzas: d.querySelectorAll('.pizza-dough').length,
        imgs: d.images.length,
        fps: +(c / 3).toFixed(1),
      });
    }};
    w.requestAnimationFrame(tick);
  });
});
console.log(GAME, JSON.stringify(res));
await b.close();
