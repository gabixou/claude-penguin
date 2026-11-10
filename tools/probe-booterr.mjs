import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.type(), m.text().slice(0, 200)); });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => {
    const g = window.__game; if (!g) return {};
    const sm = g.scene;
    return { boot: sm.isActive('BootScene'), room: sm.isActive('RoomScene'),
      bootStatus: sm.getScene('BootScene')?.sys?.settings?.status,
      roomStatus: sm.getScene('RoomScene')?.sys?.settings?.status };
  }).catch(() => ({}));
  console.log(i, JSON.stringify(st));
  if (st.room) break;
}
await b.close();
