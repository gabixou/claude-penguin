import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK = '29cb08e79c182183867765d05d45caa65f79c28ad5007f5824d61aec18828dbf'; // Arenovisk PROD
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await p.goto('https://claudepenguin.mooo.com/?token=' + TOK + '&room=igloo', { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
await p.waitForFunction(READY, null, { timeout: 180000 });
await p.waitForFunction(`(() => { const s = ${GETSC}; return s.igloo?.layout; })()`, null, { timeout: 90000 });
await p.waitForTimeout(3000);

const probe = `(() => { const s = ${GETSC}; return {
  room: s.currentRoom, typeId: s._iglooTypeId, failed: s._iglooTypeFailed ?? null,
  movieBase: s.movie?.base, movieReady: s._movieReady,
  layoutType: s.igloo?.layout?.iglooType, owner: s.igloo?.ownerId,
  bundle: [...document.scripts].map(s=>s.src).find(s=>s.includes('index-')),
}; })()`;
console.log('PROD ENTRY1:', JSON.stringify(await p.evaluate(probe)));
await p.screenshot({ path: 'tools/shots/prod-igloo-e1.png' });

await p.evaluate(`(() => { const s = ${GETSC}; s.changeRoom('town'); })()`);
await p.waitForTimeout(3000);
await p.evaluate(`(() => { const s = ${GETSC}; s.changeRoom('igloo', 380, 320); })()`);
await p.waitForFunction(`(() => { const s = ${GETSC}; return s.igloo?.layout && s._movieReady && s.currentRoom==='igloo'; })()`, null, { timeout: 120000 });
await p.waitForTimeout(3000);
console.log('PROD ENTRY2:', JSON.stringify(await p.evaluate(probe)));
await p.screenshot({ path: 'tools/shots/prod-igloo-e2.png' });
await b.close();
process.exit(0);
