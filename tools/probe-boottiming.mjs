import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', m => { const t = m.text(); if (t.includes('[boot]') || m.type() === 'error') console.log('CON', t.slice(0, 160)); });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => {
    const g = window.__game; if (!g) return {};
    return { t: performance.now().toFixed(0), boot: g.scene.isActive('BootScene'), room: g.scene.isActive('RoomScene') };
  }).catch(() => ({}));
  console.log(i, JSON.stringify(st));
  if (st.room) break;
}
await b.close();
