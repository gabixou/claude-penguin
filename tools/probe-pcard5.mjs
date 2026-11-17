import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 250)); });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
const r = await p.evaluate(async () => {
  const sc = window.__penguin.scene;
  try {
    await sc.playerCard.open(sc.localPlayer || window.__penguin);
    return { ok: true, open: sc.playerCard.isOpen };
  } catch (e) { return { ok: false, err: String(e && e.stack || e).slice(0, 500) }; }
});
console.log(JSON.stringify(r));
await p.waitForTimeout(3000);
await p.screenshot({ path: 'shots/pc-front.png', timeout: 90000 });
await b.close();
