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
console.log('game frame:', game?.url());
game.on('pageerror', e => console.log('GERR:', e.message));
await game.waitForFunction(() => window.app && document.querySelector('.start-button'), null, { timeout: 90000 });
await game.click('.start-button');
await game.waitForTimeout(1500);

// instrumenta: mainLoop (handleInput), fixedInterval (hazard move), spawns
const rates = await game.evaluate(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  window.__mlTicks = 0;
  const origHandle = window.handleInput;
  window.handleInput = function () { window.__mlTicks++; return origHandle.apply(this, arguments); };
  // conta invocacoes das funcoes registradas via fixedInterval (hazards)
  window.__fxCalls = 0; window.__fxIds = new Set();
  const origFx = window.app.fixedInterval.bind(window.app);
  window.app.fixedInterval = function (fn, ms) {
    const id = origFx(function () { window.__fxCalls++; return fn.apply(this, arguments); }, ms);
    window.__fxIds.add(id);
    return id;
  };
  window.__hazSpawns = 0;
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes)
      if (n.classList?.contains?.('hazard')) window.__hazSpawns++;
  });
  mo.observe(document.querySelector('.play-area') || document.body, { childList: true, subtree: true });
  // amostra posicoes de hazards p/ confirmar movimento
  const posSamples = [];
  for (let i = 0; i < 6; i++) {
    await sleep(1000);
    const hs = [...document.querySelectorAll('.hazard')];
    posSamples.push(hs.slice(0, 3).map(h => ({ t: h.style.transform || getComputedStyle(h).transform.slice(0, 40), gone: h.classList.contains('broken') })));
  }
  return {
    mlTicks: window.__mlTicks, fxCalls: window.__fxCalls, fxIds: window.__fxIds.size,
    hazSpawns: window.__hazSpawns, hazardsNow: document.querySelectorAll('.hazard').length,
    posSamples
  };
});
console.log(JSON.stringify(rates, null, 1));
console.log('=> mainLoop ~', (rates.mlTicks / 6).toFixed(1), 'Hz | hazard steps ~', (rates.fxCalls / 6).toFixed(1), 'Hz | fxIds:', rates.fxIds, '| spawns ~', (rates.hazSpawns / 6).toFixed(2), '/s | hazards:', rates.hazardsNow);
await b.close();
