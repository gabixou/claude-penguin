import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => {
    const g = window.__game;
    if (!g) return {};
    const sm = g.scene;
    const out = {};
    for (const k of ['BootScene', 'RoomScene']) {
      const s = sm.getScene?.(k);
      out[k] = s ? { active: s.isActive?.(), visible: s.isVisible?.(), status: s.sys?.settings?.status } : null;
    }
    return out;
  }).catch((e) => ({ err: e.message }));
  console.log(i, JSON.stringify(st));
  if (st.RoomScene?.active && i > 3) break;
}
await b.close();
