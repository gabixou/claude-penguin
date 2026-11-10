import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=dock', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.waitForTimeout(5000);
const st = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const out = { hudRect: s.gpHud?._chatRect, pill: s.gpHud?.chatPillRect?.() };
  s._layoutChatInput();
  const el = document.querySelector('input');
  const r = el.getBoundingClientRect();
  out.inp = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), fs: el.style.fontSize };
  out.listeners = s.events.listenerCount('vectorhud:ready');
  return out;
});
console.log(JSON.stringify(st, null, 1));
await b.close();
