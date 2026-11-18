import { chromium } from 'playwright-core';

const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56';
const GETSC = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;

const b = await chromium.launch({ executablePath: EXE, headless: true });

const A = await b.newPage();
await A.goto(`http://localhost:3000/?token=${TOK_A}&room=dance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await A.waitForFunction(() => window.__game, null, { timeout: 30000 });
await A.waitForFunction(`(() => { const s = ${GETSC}; return s && s._playerReady && s.localPlayer; })()`, null, { timeout: 60000 });
await A.evaluate(`${GETSC}.handleAction('dance')`);
await A.waitForTimeout(1500);
// screenshot da visao do proprio dan carino (A se ve dançando)
await A.evaluate(`${GETSC}.cameras.main.centerOn(${GETSC}.localPlayer.x, ${GETSC}.localPlayer.y)`);
await A.waitForTimeout(400);
await A.screenshot({ path: 'tools/shots/clone-dance-self.png' });

const B = await b.newPage();
await B.goto(`http://localhost:3000/?token=${TOK_B}&room=dance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await B.waitForTimeout(9000);
// centraliza a camera de B no pinguim remoto que danca
const info = await B.evaluate(`(() => { const s = ${GETSC}; const rs=[...(s.remotePlayers?.values()||[])]; const d=rs.find(p=>p.action===26)||rs[0]; if(d) s.cameras.main.centerOn(d.x,d.y); return {n:rs.length, target:d?{id:d.playerId,x:d.x,y:d.y,action:d.action,frame:d.view?.frame}:null, me:{x:s.localPlayer?.x,y:s.localPlayer?.y}}; })()`);
console.log('B info:', JSON.stringify(info));
await B.waitForTimeout(700); // deixa a animacao do dance rodar um pouco
await B.screenshot({ path: 'tools/shots/clone-dance-remote2.png' });

await b.close();
process.exit(0);
