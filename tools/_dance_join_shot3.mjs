import { chromium } from 'playwright-core';

const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const GETSC = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;
const READY = `(() => { const s = ${GETSC}; return s && s._playerReady && s._movieReady && s.localPlayer; })()`;

const b = await chromium.launch({ executablePath: EXE, headless: true });

const A = await b.newPage();
await A.goto(`http://localhost:3000/?token=${TOK_A}&room=dance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await A.waitForFunction(() => window.__game, null, { timeout: 30000 });
await A.waitForFunction(READY, null, { timeout: 90000 });
await A.evaluate(`${GETSC}.handleAction('dance')`);
await A.waitForTimeout(1500);
await A.evaluate(`${GETSC}.cameras.main.centerOn(${GETSC}.localPlayer.x, ${GETSC}.localPlayer.y - 40)`);
await A.waitForTimeout(400);
await A.screenshot({ path: 'tools/shots/clone-dance-self.png' });

const B = await b.newPage();
await B.goto(`http://localhost:3000/?token=${TOK_B}&room=dance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await B.waitForFunction(() => window.__game, null, { timeout: 30000 });
await B.waitForFunction(READY, null, { timeout: 90000 });
await B.waitForTimeout(2000); // ROOM_STATE + remote view init
// afasta o pinguim local de B do remoto p/ nao se sobrepor
await B.evaluate(`${GETSC}.localPlayer.setPosition(180, 400)`);
const info = await B.evaluate(`(() => { const s = ${GETSC}; const rs=[...(s.remotePlayers?.values()||[])]; const d=rs.find(p=>p.action===26)||rs[0]; if(d) s.cameras.main.centerOn(d.x, d.y - 40); return {n:rs.length, target:d?{id:d.playerId,x:d.x,y:d.y,action:d.action,frame:d.view?.frame,drawn:d.view?.drawnFrame}:null}; })()`);
console.log('B info:', JSON.stringify(info));
await B.waitForTimeout(700);
await B.screenshot({ path: 'tools/shots/clone-dance-remote3.png' });

await b.close();
process.exit(0);
