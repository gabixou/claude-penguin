import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://localhost:3000/minigames/pufflescape/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
const r = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  return { canvas: !!c, w: c?.width, h: c?.height, scenes: window.game ? Object.keys(window.game.scene.keys || {}) : null };
});
console.log(JSON.stringify({ r, errs: errs.slice(0, 5) }));
await p.screenshot({ path: 'shots/puffle-boot.png' });
await b.close();
