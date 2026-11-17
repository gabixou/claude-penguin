import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const t0 = Date.now();
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
// clica Skip do onboarding assim que aparecer (DOM element)
for (let i = 0; i < 60; i++) {
  const clicked = await p.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, div, span')];
    const el = els.find((e) => e.innerText?.trim() === 'Skip' || e.innerText?.trim() === 'Play');
    if (el) { el.click(); return el.innerText.trim(); }
    return null;
  }).catch(() => null);
  if (clicked) { console.log('CLICKED', clicked, ((Date.now() - t0) / 1000).toFixed(1) + 's'); break; }
  await p.waitForTimeout(500);
}
await p.waitForTimeout(12000);
await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
await p.waitForTimeout(6000);
await p.screenshot({ path: 'shots/ref-cat-p1.png' });
for (let i = 2; i <= 4; i++) {
  await p.evaluate((n) => window.penguinPanels?.current?.spec?.movie?.goto?.('book', n), i);
  await p.waitForTimeout(2500);
  console.log('frame', await p.evaluate(() => window.penguinPanels?.current?.spec?.movie?.currentFrame?.('book')));
  await p.screenshot({ path: `shots/ref-cat-p${i}.png` });
}
await b.close();
console.log('done');
