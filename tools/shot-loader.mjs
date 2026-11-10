import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const cdp = await p.context().newCDPSession(p);
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
// espera RoomScene iniciar e LoadingScreen aparecer
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(250);
  const st = await p.evaluate(() => {
    const g = window.__game; if (!g) return {};
    const s = g.scene.getScene('RoomScene');
    return { room: g.scene.isActive('RoomScene'), ls: !!s?.loadingScreen?.visible };
  }).catch(() => ({}));
  if (st.ls) {
    await p.waitForTimeout(600);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('tools/shots/clone-loader-new.png', Buffer.from(data, 'base64'));
    console.log('captured', i, JSON.stringify(st));
    break;
  }
}
await b.close();
