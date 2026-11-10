import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', m => { const t = m.text(); if (t.includes('playercard') || t.includes('paperdoll') || m.type() === 'error') console.log('[pg]', t.slice(0, 300)); });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=dock', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
for (let i = 0; i < 90; i++) {
  const open = await p.evaluate(() => !!window.__penguin.scene.playerCard?.container).catch(() => false);
  if (open) break;
  await p.waitForTimeout(1000);
}
await p.waitForTimeout(15000);
await b.close();
