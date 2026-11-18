import { chromium } from 'playwright-core';

const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const GETSC = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;

const b = await chromium.launch({ executablePath: EXE, headless: true });

const A = await b.newPage();
A.on('pageerror', (e) => console.log('[A pageerror]', String(e).slice(0, 200)));
await A.goto(`http://localhost:3000/?token=${TOK_A}&room=dance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await A.waitForFunction(() => window.__game, null, { timeout: 30000 });
await A.waitForFunction(`(() => { const s = ${GETSC}; return s && s._playerReady && s.localPlayer; })()`, null, { timeout: 60000 });
await A.evaluate(`${GETSC}.handleAction('dance')`);
await A.waitForTimeout(1200);

const B = await b.newPage();
B.on('pageerror', (e) => console.log('[B pageerror]', String(e).slice(0, 200)));
await B.goto(`http://localhost:3000/?token=${TOK_B}&room=dance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await B.waitForTimeout(9000); // room load + ROOM_STATE + view init
await B.screenshot({ path: 'tools/shots/clone-dance-remote.png' });
const st = await B.evaluate(`(() => { const s = ${GETSC}; return [...(s.remotePlayers?.values()||[])].map(p=>({id:p.playerId,action:p.action,frame:p.view?.frame,drawn:p.view?.drawnFrame})); })()`);
console.log('B remotes:', JSON.stringify(st));

// referencia: sala dance do gopenguin
const R = await b.newPage();
await R.goto('https://gopenguin.lol/?room=dance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await R.waitForTimeout(9000);
await R.screenshot({ path: 'tools/shots/ref-dance.png' });

await b.close();
process.exit(0);
