import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const TOK_A = '997acb88d1769c7ba01f2fab3e6a87b3ba7ec1be2fcbb04183fb54083c5e68bc';
const GETSC = `(() => { const g = window.__game; return g.scene.keys.RoomScene || g.scene.getScene('RoomScene'); })()`;
const b = await chromium.launch({ executablePath: EXE, headless: true });
const A = await b.newPage();
A.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 120)));
await A.goto(`http://localhost:3000/?token=${TOK_A}&room=town`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await A.waitForFunction(() => window.__game, null, { timeout: 30000 });
await A.waitForFunction(`(() => { const s = ${GETSC}; return s && s._playerReady && s._movieReady && s.localPlayer; })()`, null, { timeout: 90000 });
await A.evaluate(`${GETSC}._enterIgloo()`);
await A.waitForFunction(`(() => { const s = ${GETSC}; return s.currentRoom === 'igloo' && s._movieReady && s.movie; })()`, null, { timeout: 90000 });
await A.waitForTimeout(4000);
const bad = await A.evaluate(`(() => {
  const g = window.__game; const sc = ${GETSC};
  const out = [];
  const walk = (list, where) => {
    for (const o of list || []) {
      if (o.type === 'Image' && o.texture) {
        const t = o.texture;
        const frame = o.frame;
        let gl = null;
        try { gl = frame?.glTexture; } catch {}
        const managed = g.textures.exists(t.key);
        if (!managed || gl === null || gl === undefined) {
          out.push({ where, key: t.key, managed, gl: String(gl), visible: o.visible, depth: o.depth });
        }
      }
      if (o.list) walk(o.list, where + '/' + (o.type || '?'));
    }
  };
  for (const [k, s] of Object.entries(g.scene.keys)) walk(s.children.list, k);
  return out.slice(0, 30);
})()`);
console.log(JSON.stringify(bad, null, 1));
await b.close();
process.exit(0);
