import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
// poll ate sair de Loading (max 90s)
const res = await p.evaluate(() => new Promise((resolve) => {
  function findGameDoc(doc) {
    for (const f of doc.querySelectorAll('iframe')) {
      try {
        const w = f.contentWindow;
        if (w && w.app) return w;
        const r = w && w.document ? findGameDoc(w.document) : null;
        if (r) return r;
      } catch (e) {}
    }
    return null;
  }
  const t0 = Date.now();
  const iv = setInterval(() => {
    const w = findGameDoc(document);
    if (!w) { if (Date.now() - t0 > 90000) { clearInterval(iv); resolve({ err: 'no app' }); } return; }
    const st = w.app.currentState();
    const d = w.document;
    if (st !== 'Loading') {
      clearInterval(iv);
      resolve({
        state: st, ms: Date.now() - t0,
        imgs: d.images.length,
        loadingBar: d.querySelector('.loading-bar') ? getComputedStyle(d.querySelector('.loading-bar')).width : null,
        audioPre: d.querySelectorAll('.audioPreloaded').length,
      });
    }
  }, 1000);
}));
console.log(JSON.stringify(res));
await b.close();
