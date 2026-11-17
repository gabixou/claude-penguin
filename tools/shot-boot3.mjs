import { chromium } from 'playwright-core';
const times = [400, 800, 1400, 2000, 2600];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
let prev = 0;
for (const ms of times) {
  await p.waitForTimeout(ms - prev);
  prev = ms;
  const name = 'tools/shots/boot-t' + ms + '.png';
  await p.screenshot({ path: name, timeout: 30000 }).catch((e) => console.log('shot fail', ms, e.message));
  const st = await p.evaluate(() => ({ boot: window.__game?.scene?.isActive?.('BootScene'), room: window.__game?.scene?.isActive?.('RoomScene') })).catch(() => ({}));
  console.log(ms, JSON.stringify(st));
  if (st.room) break;
}
await b.close();
