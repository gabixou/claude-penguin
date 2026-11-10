import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=dock', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
for (let i = 0; i < 30; i++) {
  const st = await p.evaluate(() => ({
    hudRect: window.__penguin.scene.gpHud?._chatRect,
    inp: (() => { const el = document.querySelector('input'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    zones: window.__penguin.scene.gpHud?.list?.filter(o => o.type === 'Zone').length,
  })).catch(e => ({ err: String(e) }));
  console.log(i, JSON.stringify(st));
  if (st.hudRect && st.hudRect.w > 100) break;
  await p.waitForTimeout(1000);
}
await b.close();
