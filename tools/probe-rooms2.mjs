import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const rooms = process.argv[2] ? process.argv[2].split(',') : ['dance', 'mine', 'rink', 'dojo', 'beach', 'dock'];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 200)));
p.on('console', m => { const t = m.text(); if (t.includes('[movie]')) console.log('  ', t.slice(0, 200)); });
for (const room of rooms) {
  const t0 = Date.now();
  try {
    await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let st = null;
    for (let i = 0; i < 75; i++) {
      await p.waitForTimeout(2000);
      st = await p.evaluate(() => {
        const s = window.__penguin && window.__penguin.scene;
        if (!s) return { boot: true };
        const layers = s.movieLayers || [];
        // conta layers cujo canvas tem pixels nao-transparentes (amostra ampla)
        let painted = 0;
        for (const l of layers) {
          const c = l.canvas;
          if (!c || c.width < 4) continue;
          const ctx = c.getContext('2d');
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let p2 = 0;
          for (let j = 3; j < d.length; j += 4000) if (d[j] > 0) p2++;
          if (p2 > 3) painted++;
        }
        return { movie: !!s.movie, fail: !!s.roomFailText, nlayers: layers.length, painted };
      }).catch(() => null);
      if (st && st.fail) break;
      if (st && st.movie && st.nlayers > 0 && st.painted >= Math.max(1, Math.ceil(st.nlayers * 0.6))) break;
    }
    console.log(room.padEnd(8), JSON.stringify(st), ((Date.now() - t0) / 1000).toFixed(0) + 's');
    // screenshot para salas problemáticas
    if (room === 'dance' || room === 'rink' || room === 'mine') {
      await p.evaluate(() => window.__penguin.scene.game.loop.sleep());
      await p.waitForTimeout(500);
      await p.screenshot({ path: 'tools/shots/room-' + room + '.png', timeout: 60000 }).catch(() => {});
    }
  } catch (e) {
    console.log(room.padEnd(8), 'NAV-FAIL', String(e).slice(0, 120));
  }
}
await b.close();
