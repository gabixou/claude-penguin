import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const cdp = await p.context().newCDPSession(p);
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
let shot = false;
for (let i = 0; i < 80 && !shot; i++) {
  await p.waitForTimeout(120);
  const st = await p.evaluate(() => {
    const g = window.__game;
    return g ? { boot: g.scene.isActive('BootScene'), room: g.scene.isActive('RoomScene') } : {};
  }).catch(() => ({}));
  if (st.boot) {
    await p.waitForTimeout(900);
    const still = await p.evaluate(() => window.__game?.scene?.isActive?.('BootScene')).catch(() => false);
    if (!still) continue;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('tools/shots/clone-boot-loader.png', Buffer.from(data, 'base64'));
    shot = true;
    console.log('captured iter', i);
  }
  if (st.room) break;
}
await b.close();
