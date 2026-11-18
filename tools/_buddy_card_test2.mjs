import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.goto('http://localhost:3000/?token=' + TOK_B + '&room=town', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
await p.waitForFunction(READY, null, { timeout: 90000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(`(async () => {
  const s = ${GETSC};
  const soc = s.network.social;
  const buddy = (soc.buddies || []).find((x) => x.username === 'Arenovisk');
  s.buddyWindow.open();
  await new Promise((r) => setTimeout(r, 1500));
  const list = s.buddyWindow._list();
  const row = list.find((x) => x.name === 'Arenovisk');
  try {
    if (row) await Promise.resolve(s.buddyWindow._rowAction(row));
  } catch (e) { return { actionErr: String(e) }; }
  // open() e async — espera o container aparecer
  for (let i = 0; i < 40 && !s.playerCard.isOpen; i++) await new Promise((r) => setTimeout(r, 250));
  const pc = s.playerCard;
  return {
    cardOpen: pc.isOpen,
    opening: pc._opening,
    hasContainer: !!pc.container,
    user: pc.penguin?.username,
    seq: pc._openSeq,
  };
})()`);
console.log(JSON.stringify(r));
await p.waitForTimeout(500);
await p.screenshot({ path: 'tools/shots/buddy-offline-card.png' });
await b.close();
process.exit(0);
