import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('[' + m.type() + ']', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
// espera o card abrir de verdade
for (let i = 0; i < 60; i++) {
  const open = await p.evaluate(() => !!window.__penguin.scene.playerCard?.container).catch(() => false);
  if (open) break;
  await p.waitForTimeout(1000);
}
const info = await p.evaluate(() => {
  const card = window.__penguin.scene.playerCard;
  const cont = card.container;
  if (!cont) return { open: false };
  const zones = cont.list.filter(o => o.type === 'Zone');
  return {
    open: true, zones: zones.length,
    zoneInfo: zones.slice(0, 12).map(z => ({ x: Math.round(z.x), y: Math.round(z.y), w: z.width, h: z.height })),
    children: cont.list.length,
  };
});
console.log(JSON.stringify(info, null, 1));
// clica no centro da primeira zona (provavel close_btn esta na lista?)
if (info.open && info.zones) {
  const r = await p.evaluate(() => {
    const cont = window.__penguin.scene.playerCard.container;
    const z = cont.list.find(o => o.type === 'Zone');
    const wp = z.getWorldTransformMatrix();
    // converte posicao local p/ tela aprox: container em cx-dw/2
    return { x: z.x, y: z.y, wx: wp.e, wy: wp.f };
  });
  console.log('first zone world-ish', JSON.stringify(r));
}
await p.screenshot({ path: 'shots/pc-debug.png', timeout: 90000 });
await b.close();
