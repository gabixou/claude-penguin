import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
p.on('console', (m) => { const t = m.text(); if (/igloo|movie|room-load|room-pack/i.test(t)) console.log('LOG', t.slice(0, 160)); });
await p.goto('http://localhost:3000/?token=' + TOK_A + '&room=igloo', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
await p.waitForFunction(READY, null, { timeout: 120000 });
await p.waitForFunction(`(() => { const s = ${GETSC}; return s.igloo?.layout; })()`, null, { timeout: 60000 });
await p.waitForTimeout(2500);

const probe = `(() => { const s = ${GETSC}; return {
  room: s.currentRoom, typeId: s._iglooTypeId, failed: s._iglooTypeFailed,
  movieBase: s.movie?.base, movieReady: s._movieReady,
  layoutType: s.igloo?.layout?.iglooType, owner: s.igloo?.ownerId,
}; })()`;
console.log('ENTRY1:', JSON.stringify(await p.evaluate(probe)));
await p.screenshot({ path: 'tools/shots/igloo-type-entry1.png' });

// sai do iglu -> town -> volta
await p.evaluate(`(() => { const s = ${GETSC}; s.changeRoom('town'); })()`);
await p.waitForTimeout(2500);
await p.evaluate(`(() => { const s = ${GETSC}; s.changeRoom('igloo', 380, 320); })()`);
await p.waitForFunction(READY, null, { timeout: 120000 });
await p.waitForFunction(`(() => { const s = ${GETSC}; return s.igloo?.layout && s._movieReady; })()`, null, { timeout: 60000 });
await p.waitForTimeout(2500);
console.log('ENTRY2:', JSON.stringify(await p.evaluate(probe)));
await p.screenshot({ path: 'tools/shots/igloo-type-entry2.png' });
await b.close();
process.exit(0);
