import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => {
    const g = window.__game; if (!g) return {};
    const sm = g.scene;
    const s = sm.getScene('BootScene');
    return {
      mgrIsActive: sm.isActive ? sm.isActive('BootScene') : 'NO-METHOD',
      sceneIsActive: typeof s?.isActive === 'function' ? s.isActive() : 'NO-METHOD',
      sysActive: s?.sys?.isActive?.(),
      status: s?.sys?.settings?.status,
      roomStatus: sm.getScene('RoomScene')?.sys?.settings?.status
    };
  }).catch((e) => ({ err: e.message }));
  console.log(i, JSON.stringify(st));
  if (st.roomStatus === 5) break;
}
await b.close();
