import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view?.drawnFrame > 0, null, { timeout: 30000 });
// anda na diagonal p/ capturar penguin em walk
await p.evaluate(() => {
  const s = window.__penguin.scene, lp = s.localPlayer;
  lp.moveTo(lp.x + 260, lp.y - 140, 150);
});
await p.waitForTimeout(600);
await p.screenshot({ path: 'tools/shots/clone-town-walk.png' });
console.log('shot ok');
await b.close();
