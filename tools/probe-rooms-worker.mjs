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
    for (let i = 0; i < 240; i++) {
      await p.waitForTimeout(2000);
      st = await p.evaluate(() => {
        const s = window.__penguin && window.__penguin.scene;
        if (!s) return { boot: true };
        const layers = s.movieLayers || [];
        let painted = 0, total = 0;
        for (const l of layers) {
          const c = l.canvas;
          if (!c || c.width < 4) continue;
          const d = c.getContext('2d').getImageData(0, 0, Math.min(c.width, 200), Math.min(c.height, 120)).data;
          let p2 = 0;
          for (let j = 3; j < d.length; j += 40) if (d[j] > 0) p2++;
          total++; if (p2 > 2) painted++;
        }
        return { movie: !!s.movie, fail: !!s.roomFailText, nlayers: layers.length, painted, total };
      }).catch(() => null);
      if (st && st.movie && st.nlayers > 0 && st.painted >= Math.ceil(st.total * 0.7)) break;
      if (st && st.fail) break;
    }
    // screenshot final
    try { await p.screenshot({ path: `tools/shots/room-${room}.png`, timeout: 60000 }); } catch (e) { console.log(room, 'shot-fail'); }
    console.log(room.padEnd(8), JSON.stringify(st), ((Date.now() - t0) / 1000).toFixed(0) + 's');
  } catch (e) {
    console.log(room.padEnd(8), 'NAV-FAIL', String(e).slice(0, 120));
  }
}
await b.close();
