import { chromium } from 'playwright-core';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const cdp = await p.context().newCDPSession(p);
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => {
    const g = window.__game; if (!g) return {};
    const s = g.scene.getScene('BootScene');
    return { boot: g.scene.isActive('BootScene'),
      children: s?.children?.length ?? 0,
      logo: g.textures.exists('logo') };
  }).catch(() => ({}));
  // create() rodou quando ha objetos na display list (bg+halo+logo+cap+fill = 5)
  if (st.boot && st.children >= 5) {
    await p.waitForTimeout(800);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('tools/shots/clone-boot-loader.png', Buffer.from(data, 'base64'));
    console.log('captured iter', i, JSON.stringify(st));
    break;
  }
}
await b.close();
