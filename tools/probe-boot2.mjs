import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
for (const ms of [300, 600, 900]) {
  await p.waitForTimeout(ms === 300 ? 300 : ms - (ms === 600 ? 300 : 600));
  const r = await p.evaluate(() => {
    const g = window.__penguin;
    const sm = g?.scene;
    return { bootActive: sm?.isActive?.('BootScene'), texLogo: g?.textures?.exists?.('logo') };
  });
  console.log(ms, JSON.stringify(r));
}
await b.close();
