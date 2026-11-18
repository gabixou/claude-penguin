import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const GETSC = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;
const READY = `(() => { const s = ${GETSC}; return s && s._playerReady && s._movieReady && s.localPlayer; })()`;

const b = await chromium.launch({ executablePath: EXE, headless: true });

// clone — Arenovisk em town e dance
const C = await b.newPage();
C.on('pageerror', (e) => console.log('[clone pageerror]', String(e).slice(0, 120)));
await C.goto(`http://localhost:3000/?token=${TOK_A}&room=town`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await C.waitForFunction(() => window.__game, null, { timeout: 30000 });
await C.waitForFunction(READY, null, { timeout: 90000 });
await C.waitForTimeout(4000);
await C.screenshot({ path: 'tools/shots/clone-town.png' });
await C.evaluate(`${GETSC}.changeRoom('dance')`);
await C.waitForFunction(`(() => { const s = ${GETSC}; return s.currentRoom === 'dance' && s._movieReady; })()`, null, { timeout: 90000 });
await C.waitForTimeout(3000);
await C.screenshot({ path: 'tools/shots/clone-dance.png' });

// referencia gopenguin
for (const room of ['town', 'dance']) {
  const R = await b.newPage();
  await R.goto(`https://gopenguin.lol/?room=${room}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await R.waitForTimeout(10000);
  await R.screenshot({ path: `tools/shots/ref-${room}.png` });
  await R.close();
}
await b.close();
process.exit(0);
