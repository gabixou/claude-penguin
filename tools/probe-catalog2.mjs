import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=town', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
// clothing catalogo — paginas com itens
await p.evaluate(() => window.__penguin.scene.catalogue?.open?.('clothing'));
await p.waitForTimeout(5000);
for (const pg of [2, 3, 4]) {
  await p.evaluate((n) => { const c = window.__penguin.scene.catalogue; c.movie.goto('book', n); c._show(); }, pg);
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `tools/shots/cat-clothing-p${pg}.png` });
  console.log('shot page', pg);
}
await p.evaluate(() => window.__penguin.scene.catalogue?.close?.());
await p.waitForTimeout(500);
// pets catalogo
await p.evaluate(() => window.__penguin.scene.catalogue?.open?.('pets'));
await p.waitForTimeout(5000);
for (const pg of [1, 2]) {
  await p.evaluate((n) => { const c = window.__penguin.scene.catalogue; c.movie.goto('book', n); c._show(); }, pg);
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `tools/shots/cat-pets-p${pg}.png` });
  console.log('shot pets page', pg);
}
await b.close();
