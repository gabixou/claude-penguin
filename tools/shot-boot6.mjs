import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
// poll manual até BootScene ativo + create() ter rodado
let shot = false;
for (let i = 0; i < 100; i++) {
  await p.waitForTimeout(150);
  const st = await p.evaluate(() => {
    const g = window.__game;
    return g ? { boot: g.scene.isActive('BootScene'), room: g.scene.isActive('RoomScene') } : {};
  }).catch(() => ({}));
  if (st.boot && !shot) {
    // espera create() popular a tela (logo/text/bar são síncronos no create)
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'tools/shots/clone-boot-loader.png', timeout: 30000 }).catch((e) => console.log('shot fail', e.message.split('\n')[0]));
    shot = true;
    console.log('captured at iter', i, JSON.stringify(st));
  }
  if (st.room) { console.log('room at iter', i); break; }
}
await b.close();
