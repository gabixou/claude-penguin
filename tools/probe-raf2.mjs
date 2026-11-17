import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForSelector('iframe', { timeout: 30000 });
let outer = p.frames().find(f => f.url().includes('beancounters/index.html'));
await outer.waitForTimeout(3000);
const game = outer.childFrames()[0];
game.on('pageerror', e => console.log('GERR:', e.message));
await game.waitForFunction(() => window.app && document.querySelector('.start-button'), null, { timeout: 90000 });

// patch ANTES do start: captura mainLoop + todos os hazard moves
await game.evaluate(() => {
  window.__perFn = [];
  const origFx = window.app.fixedInterval.bind(window.app);
  window.app.fixedInterval = function (fn, ms) {
    const rec = { n: 0, ms: ms, src: String(fn).replace(/\s+/g, ' ').slice(0, 60) };
    const id = origFx(function () { rec.n++; return fn.apply(this, arguments); }, ms);
    rec.id = id;
    window.__perFn.push(rec);
    return id;
  };
});
await game.click('.start-button');
await game.waitForTimeout(8000);

const r = await game.evaluate(() => ({
  perFn: window.__perFn.map(s => ({ id: s.id, ms: s.ms, n: s.n, src: s.src })),
  hazards: document.querySelectorAll('.hazard').length
}));
console.log('hazards now:', r.hazards);
for (const f of r.perFn) console.log(`id=${f.id} ms=${f.ms} calls=${f.n} (~${(f.n / 8).toFixed(1)}Hz) src=${f.src}`);
await b.close();
