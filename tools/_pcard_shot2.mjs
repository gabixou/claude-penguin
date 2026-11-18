import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const boot = async (token) => {
  const p = await b.newPage();
  await p.goto('http://localhost:3000/?token=' + token + '&room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await p.waitForFunction(READY, null, { timeout: 90000 });
  return p;
};

await boot(TOK_A);
const B = await boot(TOK_B);
await B.waitForTimeout(2500);

// abre card do remoto e espera isOpen de verdade
await B.evaluate(`(() => { const s = ${GETSC}; const r = [...s.remotePlayers.values()][0]; s.playerCard.open(r); })()`);
await B.waitForFunction(`(() => { const s = ${GETSC}; return s.playerCard && s.playerCard.isOpen; })()`, null, { timeout: 30000 });
await B.waitForTimeout(800);
await B.screenshot({ path: 'tools/shots/pcard-other2.png' });

await B.evaluate(`(() => { const s = ${GETSC}; s.playerCard.open(s.localPlayer); })()`);
await B.waitForFunction(`(() => { const s = ${GETSC}; return s.playerCard && s.playerCard.isOpen && s.playerCard.penguin === s.localPlayer; })()`, null, { timeout: 30000 }).catch(() => {});
await B.waitForTimeout(800);
await B.screenshot({ path: 'tools/shots/pcard-self2.png' });
await b.close();
process.exit(0);
