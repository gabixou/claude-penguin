import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', m => console.log('PG>', m.text().slice(0,140)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('roundup'));
await p.waitForFunction(() => !!document.querySelector('iframe[src*="pufflescape"]'), null, { timeout: 20000 });
// chama o handler diretamente com evento fake
const r = await p.evaluate(() => {
  const s = window.__penguin.scene, mg = s._minigame;
  const f = document.querySelector('iframe[src*="pufflescape"]');
  try {
    mg._handleMessage({ source: f.contentWindow, data: { source: 'pufflescape', type: 'level-complete', level: 1 } });
    return { direct: 'ok', coins: s.network.coins };
  } catch (e) { return { direct: 'err:' + e.message }; }
});
console.log('DIRECT:', JSON.stringify(r));
await p.waitForTimeout(1000);
console.log('COINS NOW:', await p.evaluate(() => window.__penguin.scene.network.coins));
// agora via postMessage real
await p.evaluate(() => {
  const f = document.querySelector('iframe[src*="pufflescape"]');
  f.contentWindow.postMessage({ source: 'pufflescape', type: 'level-complete', level: 1 }, location.origin);
});
await p.waitForTimeout(1200);
console.log('AFTER POSTMSG coins:', await p.evaluate(() => window.__penguin.scene.network.coins),
  'toast:', await p.evaluate(() => [...document.querySelectorAll('div')].some(d => /Level 1 complete/.test(d.textContent || ''))));
await b.close();
