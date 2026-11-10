import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('http://localhost:3000/?room=mine', { waitUntil: 'domcontentloaded' });
// espera movie + renders
let st = null;
for (let i = 0; i < 90; i++) {
  await p.waitForTimeout(2000);
  st = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    return s && s.movie ? { movie: true, nl: (s.movieLayers || []).length } : { movie: false };
  }).catch(() => null);
  if (st && st.movie && st.nl > 10) {
    // espera mais um pouco para renders
    await p.waitForTimeout(15000);
    break;
  }
}
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return (s.movieLayers || []).map((l, i) => {
    const c = l.canvas, ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let white = 0, bbox = null, painted = 0;
    for (let y = 0; y < c.height; y += 3) for (let x = 0; x < c.width; x += 3) {
      const j = (y * c.width + x) * 4;
      if (d[j + 3] < 100) continue;
      painted++;
      if (d[j] > 235 && d[j + 1] > 235 && d[j + 2] > 235) {
        white++;
        if (!bbox) bbox = [x, y, x, y];
        else { bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y); bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y); }
      }
    }
    return { i, name: l.entry.name || ('#' + l.entry.id), white, painted, bbox };
  });
});
console.log(JSON.stringify(r.filter(x => x.white > 50 || x.painted === 0), null, 1));
await b.close();
