import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
// dispara dance o mais cedo possivel — antes do warm terminar
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.handleAction('dance'));
// amostra frameReady + af ao longo do tempo
for (let i = 0; i < 12; i++) {
  const st = await p.evaluate(() => {
    const lp = window.__penguin.scene.localPlayer;
    if (!lp?.view) return null;
    return {
      t: Math.round(performance.now()),
      frame: lp.action, af: lp.view.animationFrame,
      ready: lp.view.frameReady(), drawn: lp.view.drawnFrame,
      items: lp.view.items.size
    };
  });
  console.log(JSON.stringify(st));
  await p.waitForTimeout(700);
}
await p.screenshot({ path: 'tools/shots/issue19-fixed-dance.png' });
await b.close();
