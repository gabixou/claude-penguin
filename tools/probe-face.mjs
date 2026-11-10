import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
// move mouse para cima do pinguim, depois para os lados — verifica direction
const res = await p.evaluate(async () => {
  const lp = window.__penguin, scene = lp.scene;
  const out = { start: lp.direction };
  // simula ponteiro em varios pontos do mundo
  for (const [wx, wy] of [[380, 100], [700, 312], [60, 312], [380, 450]]) {
    scene._pointerWorld = { x: wx, y: wy };
    lp.facePoint(wx, wy);
    await new Promise(r => setTimeout(r, 300));
    out['p' + wx + ',' + wy] = lp.direction;
  }
  return out;
});
console.log(JSON.stringify(res));
await b.close();
