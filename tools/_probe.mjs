import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
p.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(0, 120), r.failure()?.errorText));
await p.goto('http://localhost:3000/?token=' + TOK_B + '&room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(30000);
const st = await p.evaluate(`(() => {
  const g = window.__game;
  if (!g) return { game: false };
  const keys = Object.keys(g.scene.keys);
  const s = g.scene.keys.RoomScene || g.scene.getScene('RoomScene');
  return { game: true, keys, active: g.scene.isActive('RoomScene'),
    ready: s ? { pr: s._playerReady, mr: s._movieReady, lp: !!s.localPlayer } : null };
})()`);
console.log(JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/buddy-probe.png' });
await b.close();
process.exit(0);
