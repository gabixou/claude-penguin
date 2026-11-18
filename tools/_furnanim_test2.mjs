import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await p.goto('http://localhost:3000/?token=' + TOK_A + '&room=igloo', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
await p.waitForFunction(READY, null, { timeout: 120000 });
await p.waitForFunction(`(() => { const s = ${GETSC}; return s.igloo && s.igloo._animItems?.length > 0; })()`, null, { timeout: 60000 });
await p.waitForTimeout(800);

const probe = `(() => { const s = ${GETSC}; return s.igloo._animItems.map((a) => ({
  tex: a.texKey,
  ph: [...a.clip.playheads.entries()].map(([k, v]) => k + '=' + v.frame + (v.playing ? 'P' : 'S')),
})); })()`;
const s1 = await p.evaluate(probe);
console.log('t0:', JSON.stringify(s1));
await p.screenshot({ path: 'tools/shots/igloo-furn-anim-t0.png' });
await p.waitForTimeout(900);
const s2 = await p.evaluate(probe);
console.log('t1:', JSON.stringify(s2));
await p.screenshot({ path: 'tools/shots/igloo-furn-anim-t1.png' });
await b.close();
process.exit(0);
