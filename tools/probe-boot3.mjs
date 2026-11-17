import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
// captura estado a cada 200ms até RoomScene ficar ativa
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const g = window.__game;
    if (!g) return { t: 'no-game' };
    return {
      boot: g.scene.isActive('BootScene'),
      room: g.scene.isActive('RoomScene'),
      texLogo: g.textures.exists('logo'),
      prog: g.textures.exists('logo') ? g.textures.get('logo').key : null
    };
  });
  console.log(JSON.stringify(r));
  if (r.room) break;
}
await b.close();
