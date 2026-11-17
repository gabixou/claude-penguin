import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForTimeout(12000);
const res = await p.evaluate(() => {
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
  const w = findGameDoc(document);
  if (!w) return { err: 'no app' };
  const d = w.document;
  const bar = d.querySelector('.loading-bar');
  const audios = [...d.querySelectorAll('audio.audioPreloaded')].map(a => ({ src: a.src.split('/').pop(), rs: a.readyState, ns: a.networkState, err: a.error && a.error.code }));
  return {
    state: w.app.currentState(),
    readyState: d.readyState,
    barWidth: bar ? getComputedStyle(bar).width : null,
    audioCount: audios.length,
    audioSample: audios.slice(0, 8),
    imgs: d.images.length,
  };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
