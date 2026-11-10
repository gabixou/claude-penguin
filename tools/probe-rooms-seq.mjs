import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const rooms = process.argv.slice(2);
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 150)));
for (const room of rooms) {
  const t0 = Date.now();
  try {
    await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let st = null;
    for (let i = 0; i < 300; i++) {
      await p.waitForTimeout(3000);
      st = await p.evaluate(() => {
        const s = window.__penguin && window.__penguin.scene;
        if (!s) return { boot: true };
        const layers = s.movieLayers || [];
        if (!layers.length) return { movie: !!s.movie, fail: !!s.roomFailText, nlayers: 0 };
        const busy = layers.filter(l => l._busy).length;
        // amostra barata: 1 canvas, grade 20x12
        let painted = 0;
        const l0 = layers[Math.floor(layers.length / 2)];
        const c = l0 && l0.canvas;
        if (c && c.width > 4) {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let j = 3; j < d.length; j += 4 * 97) if (d[j] > 0) painted++;
        }
        return { movie: !!s.movie, fail: !!s.roomFailText, nlayers: layers.length, busy, painted };
      }).catch(() => null);
      if (st && st.fail) break;
      if (st && st.movie && st.nlayers > 0 && st.busy === 0 && st.painted > 0) break;
    }
    try { await p.screenshot({ path: 'shots/room-' + room + '.png', timeout: 90000 }); } catch (e) { console.log(room, 'shot-fail'); }
    console.log(room.padEnd(8), JSON.stringify(st), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  } catch (e) {
    console.log(room.padEnd(8), 'NAV-FAIL', String(e).slice(0, 120));
  }
}
await b.close();
