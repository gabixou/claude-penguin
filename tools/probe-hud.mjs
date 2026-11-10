import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => {
    const sc = window.__penguin?.scene;
    return !!(sc && sc._movieReady && sc.localPlayer?.view && sc.gpHud && sc.gpHud.list.length > 2);
  }).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
const st = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const zones = sc.gpHud.list.filter((o) => o.type === 'Zone')
    .map((z) => ({ x: Math.round(z.x), y: Math.round(z.y) }));
  return { children: sc.gpHud.list.length, zones: zones.length, sample: zones.slice(0, 20),
    chatRect: sc.gpHud.chatPillRect() };
});
console.log(JSON.stringify(st));
await p.screenshot({ path: 'shots/hud-vector.png' });
// clica no map_mc (zona ~48,440) para testar
const c = await p.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top, w: r.width, h: r.height };
});
await p.mouse.click(c.left + (48 / 760) * c.w, c.top + (440 / 480) * c.h);
await p.waitForTimeout(1500);
const mapOpen = await p.evaluate(() => window.__penguin.scene.mapOpen);
console.log('mapOpen apos click map_mc:', mapOpen);
await b.close();
