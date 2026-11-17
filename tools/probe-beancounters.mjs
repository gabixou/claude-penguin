import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/minigames/beancounters/index.html', { waitUntil: 'load' });
await p.waitForTimeout(9000);
const r = await p.evaluate(() => {
  const f = document.querySelector('iframe.game-box');
  const d = f.contentDocument, w = f.contentWindow;
  const btn = d.querySelector('.start-button');
  if (btn) { btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return 'clicked'; }
  return 'no btn, state=' + w.app?.currentState?.();
});
console.log('play:', r);
await p.waitForTimeout(2500);
const state = await p.evaluate(() => {
  const f = document.querySelector('iframe.game-box');
  const d = f.contentDocument, w = f.contentWindow;
  return {
    state: w.app?.currentState?.(),
    score: d.querySelector('.score')?.textContent,
    truck: d.querySelector('.truck-num')?.textContent,
    player: !!d.querySelector('.player'),
    hazards: d.querySelectorAll('.hazard').length,
    stackBags: d.querySelectorAll('.stack .bag').length,
  };
});
console.log('game state:', JSON.stringify(state));
await p.screenshot({ path: 'tools/shots/beancounters-test.png' });
await b.close();
