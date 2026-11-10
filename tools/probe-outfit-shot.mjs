import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
// espera sala pronta (loading screen escondido) + roupas carregadas
await p.waitForFunction(() => {
  const pg = window.__penguin;
  return pg && pg.view && pg.view.items.size === 6;
}, null, { timeout: 120000 });
await p.waitForFunction(() => {
  const ls = window.__ls;
  return !ls || !ls.visible;
}, null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2000);
await p.screenshot({ path: 'tools/shots/probe-outfit3.png' });
const n = await p.evaluate(() => window.__penguin.view.items.size);
console.log('items=' + n);
await b.close();
