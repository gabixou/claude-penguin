import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.showChat('Waddle on! Teste de balão fiel do Club Penguin.'));
await p.waitForTimeout(4000);
const st = await p.evaluate(() => {
  const lp = window.__penguin;
  return { visible: lp.chatBubble.visible, children: lp.chatBubble.list.length,
    pos: { x: lp.chatBubble.x, y: lp.chatBubble.y } };
});
console.log(JSON.stringify(st));
await p.screenshot({ path: 'shots/bubble-test.png' });
await b.close();
