import { chromium } from 'playwright-core';

const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc'; // Arenovisk (igloo_type=15, 5 pets)
const TOK_B = 'd06bd531bfed4adbb8f62e6420bcdaa04c6b4b8ebfd35072b96a4a6add312e56'; // Penguin Test
const ARENO = 'p_f4d97ddd8855';
const GETSC = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;
const READY = `(() => { const s = ${GETSC}; return s && s._playerReady && s._movieReady !== false && s.localPlayer; })()`;

const b = await chromium.launch({ executablePath: EXE, headless: true });

async function boot(token, room) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  p.on('console', (m) => { const t = m.text(); if (t.includes('[igloo]') || t.includes('IGLOO')) console.log('[pg]', t.slice(0, 160)); });
  await p.goto(`http://localhost:3000/?token=${token}&room=${room}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await p.waitForFunction(READY, null, { timeout: 90000 });
  return p;
}
const iglooState = `(() => { const s = ${GETSC}; return { room: s.currentRoom, base: s.movie?.base, tid: s._iglooTypeId, failed: s._iglooTypeFailed, layoutType: s.igloo?.layout?.iglooType, pets: s.igloo?.pets?.length, iglooPets: s.iglooPetViews?.size, owner: s.igloo?.ownerId, isOwner: s.igloo?.isOwner }; })()`;

// ---------- TESTE 1: re-entrada no proprio iglu (tipo 15) ----------
const A = await boot(TOK_A, 'town');
console.log('A town:', JSON.stringify(await A.evaluate(iglooState)));
await A.evaluate(`${GETSC}._enterIgloo()`);
await A.waitForFunction(`(() => { const s = ${GETSC}; return s.currentRoom === 'igloo' && s._movieReady && s.movie; })()`, null, { timeout: 90000 });
await A.waitForTimeout(2500); // IGLOO_STATE + sync tipo + pets
console.log('A igloo #1:', JSON.stringify(await A.evaluate(iglooState)));
await A.screenshot({ path: 'tools/shots/igloo-reentry-1.png' });

// sai para town e volta
await A.evaluate(`${GETSC}.changeRoom('town')`);
await A.waitForFunction(`(() => { const s = ${GETSC}; return s.currentRoom === 'town' && s._movieReady; })()`, null, { timeout: 90000 });
await A.evaluate(`${GETSC}._enterIgloo()`);
await A.waitForFunction(`(() => { const s = ${GETSC}; return s.currentRoom === 'igloo' && s._movieReady && s.movie; })()`, null, { timeout: 90000 });
await A.waitForTimeout(2500);
console.log('A igloo #2:', JSON.stringify(await A.evaluate(iglooState)));
await A.screenshot({ path: 'tools/shots/igloo-reentry-2.png' });

// ---------- TESTE 2: visitante ve os pets do dono ----------
const B = await boot(TOK_B, 'town');
await B.evaluate(`(() => { const s = ${GETSC}; s.visitIgloo('${ARENO}'); })()`);
await B.waitForFunction(`(() => { const s = ${GETSC}; return s.currentRoom === 'igloo' && s._movieReady && s.movie; })()`, null, { timeout: 90000 });
await B.waitForTimeout(3000); // IGLOO_STATE + pets spawn + wander
console.log('B visitando igloo de A:', JSON.stringify(await B.evaluate(iglooState)));
await B.screenshot({ path: 'tools/shots/igloo-visitor-pets.png' });

await b.close();
process.exit(0);
