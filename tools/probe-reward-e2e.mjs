import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const before = await p.evaluate(() => window.__penguin.scene.network.coins);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('roundup'));
await p.waitForFunction(() => !!document.querySelector('iframe[src*="pufflescape"]'), null, { timeout: 20000 });
await p.waitForTimeout(1000);
// dispara o level-complete de dentro do iframe (mesmo caminho do Exit.js)
await p.evaluate(() => {
  const f = document.querySelector('iframe[src*="pufflescape"]');
  f.contentWindow.postMessage({ source: 'pufflescape', type: 'level-complete', level: 1 }, location.origin);
});
await p.waitForTimeout(1200);
const after = await p.evaluate(() => ({
  coins: window.__penguin.scene.network.coins,
  toast: [...document.querySelectorAll('div')].some(d => /Level 1 complete/.test(d.textContent || '')),
}));
console.log(JSON.stringify({ before, after, errs: errs.slice(0, 3) }));
await p.screenshot({ path: 'shots/puffle-reward.png' });
await b.close();
