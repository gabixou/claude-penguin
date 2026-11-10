import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
// warm-up: baixa fonte e assets para o cache
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => document.fonts.ready).catch(() => {});
await p.waitForTimeout(3000);
// segunda carga: cache quente, screenshot não trava em fonts
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
let shot = false;
for (let i = 0; i < 60 && !shot; i++) {
  await p.waitForTimeout(120);
  const st = await p.evaluate(() => {
    const g = window.__game;
    return g ? { boot: g.scene.isActive('BootScene'), room: g.scene.isActive('RoomScene') } : {};
  }).catch(() => ({}));
  if (st.boot) {
    await p.waitForTimeout(500); // create() já rodou: logo+texto+barra
    await p.screenshot({ path: 'tools/shots/clone-boot-loader.png', timeout: 20000 }).catch((e) => console.log('shot fail', e.message.split('\n')[0]));
    shot = true;
    console.log('captured iter', i);
  }
  if (st.room) break;
}
await b.close();
