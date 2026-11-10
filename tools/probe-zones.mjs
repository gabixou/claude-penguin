import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => !!(window.__penguin?.scene?._movieReady && window.__penguin?.scene?.localPlayer?.view)).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
await p.evaluate(() => window.__penguin.scene.toggleMap());
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(1000);
  const v = await p.evaluate(() => window.__penguin.scene.islandMap?.container?.visible).catch(() => false);
  if (v) break;
}
const zones = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  return sc.islandMap.container.list
    .filter((o) => o.type === 'Zone')
    .map((z) => ({ x: Math.round(z.x), y: Math.round(z.y), w: z.width, h: z.height,
      enabled: z.input?.enabled, vis: z.visible, parentVis: z.parentContainer?.visible }));
});
console.log(JSON.stringify(zones, null, 0));
// testa hitTest manual na posicao do dock
const hit = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const cam = sc.cameras.main;
  // converte world->screen->pointer fake: hitTestPointer precisa de pointer real; usa input manager hitTest
  const pointer = sc.input.activePointer;
  // simula: move ponteiro virtual nao e facil; retorna lista de objetos na posicao via input.hitTest
  return null;
});
await b.close();
