import { chromium } from 'playwright-core';

const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc'; // Arenovisk
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56'; // Penguin Test

const b = await chromium.launch({ executablePath: EXE, headless: true });

async function boot(page, token, room) {
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.goto(`http://localhost:3000/?token=${token}&room=${room}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.waitForFunction(() => {
    const g = window.__game;
    const sc = g?.scene?.keys?.RoomScene || g?.scene?.getScene?.('RoomScene');
    return sc && sc._playerReady && sc.localPlayer;
  }, null, { timeout: 60000 });
  return page;
}

const sceneOf = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;

// A entra dançando
const A = await b.newPage();
await boot(A, TOK_A, 'dance');
await A.evaluate((s) => { const sc = eval(s); sc.handleAction('dance'); }, sceneOf);
await A.waitForTimeout(1500);
const aState = await A.evaluate((s) => {
  const sc = eval(s);
  return { me: sc.network?.playerId, action: sc.localPlayer?.action, frame: sc.localPlayer?.view?.frame };
}, sceneOf);
console.log('A:', JSON.stringify(aState));

// B entra na mesma sala DEPOIS de A ja dançar
const B = await b.newPage();
await boot(B, TOK_B, 'dance');
await B.waitForTimeout(3000); // ROOM_STATE + view init + renders
const bState = await B.evaluate((s) => {
  const sc = eval(s);
  return {
    me: sc.network?.playerId,
    remotes: [...(sc.remotePlayers?.values() || [])].map((p) => ({
      id: p.playerId, action: p.action, viewFrame: p.view?.frame, drawn: p.view?.drawnFrame, hasView: !!p.view,
    })),
  };
}, sceneOf);
console.log('B:', JSON.stringify(bState, null, 1));

await b.close();
process.exit(0);
