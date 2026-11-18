import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const GETSC = '(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene(\'RoomScene\'); })()';
const READY = '(() => { const s = ' + GETSC + '; return s && s._playerReady && s._movieReady && s.localPlayer; })()';

const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/?token=' + TOK_A + '&room=igloo', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForFunction(() => window.__game, null, { timeout: 30000 });
await p.waitForFunction(READY, null, { timeout: 120000 });
await p.waitForFunction(`(() => { const s = ${GETSC}; return s.igloo && s.igloo._animItems?.length > 0; })()`, null, { timeout: 60000 });
await p.waitForTimeout(600);

const snap = async () => p.evaluate(`(() => {
  const s = ${GETSC};
  const a = s.igloo._animItems.find((x) => x.clip.playheads.size > 0) || s.igloo._animItems[0];
  const d = a.canvas.getContext('2d').getImageData(0, 0, a.canvas.width, a.canvas.height).data;
  let sum = 0; for (let i = 0; i < d.length; i += 97) sum = (sum + d[i] + d[i+1] + d[i+2]) % 100000;
  return { key: a.texKey, sum, w: a.canvas.width, h: a.canvas.height };
})()`);
const s1 = await snap();
await p.waitForTimeout(500);
const s2 = await snap();
console.log(JSON.stringify({ s1, s2, changed: s1.sum !== s2.sum }));
await b.close();
process.exit(0);
