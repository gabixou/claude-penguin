import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  const ls = sc.loadingScreen;
  return sc.movie && sc._movieReady && (!ls || !ls.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(500);

const info = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const ix = sc._interactions;
  return {
    room: sc.currentRoom,
    buttons: (ix?.buttons || []).map((b) => ({
      path: b.path, name: b.name, walk: b.walk,
      bounds: b.bounds.map((v) => Math.round(v)),
      hover: b.hover,
    })),
  };
});
console.log(JSON.stringify(info, null, 1));

// hover no centro do shop_btn
const shop = info.buttons.find((b) => /shop/i.test(b.path + b.name));
if (shop) {
  const cx = (shop.bounds[0] + shop.bounds[2]) / 2;
  const cy = (shop.bounds[1] + shop.bounds[3]) / 2;
  const rect = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const sx = rect.x + (cx / 760) * rect.w;
  const sy = rect.y + (cy / 480) * rect.h;
  await p.mouse.move(sx, sy);
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => ({
    hovered: window.__penguin.scene._interactions?.hovered,
    states: [...(window.__penguin.scene.movie._buttonStates.entries())],
  }));
  console.log('after hover:', JSON.stringify(st));
}
await b.close();
