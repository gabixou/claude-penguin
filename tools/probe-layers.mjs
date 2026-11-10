import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const movie = scene.movie;
  if (!movie) return { err: 'no movie', layers: scene.movieLayers?.length };
  const layers = movie.topLevelLayers();
  const res = [];
  for (const l of layers) {
    const cv = document.createElement('canvas');
    cv.width = 760; cv.height = 480;
    try {
      await movie.renderLayer(l.entry, cv, 1);
      const d = cv.getContext('2d').getImageData(0, 0, 760, 480).data;
      let green = 0, dark = 0, bbox = null;
      for (let y = 0; y < 480; y += 2) for (let x = 0; x < 760; x += 2) {
        const i = (y * 760 + x) * 4;
        const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3];
        if (A < 40) continue;
        if (G > 150 && G > R * 1.5 && G > B * 1.5) {
          green++;
          if (!bbox) bbox = [x, y, x, y];
          else { bbox[0] = Math.min(bbox[0], x); bbox[1] = Math.min(bbox[1], y); bbox[2] = Math.max(bbox[2], x); bbox[3] = Math.max(bbox[3], y); }
        }
        if (R < 60 && G < 80 && B < 110) dark++;
      }
      res.push({ name: l.entry.name || ('#' + l.entry.id), z: l.z, green, dark, bbox });
    } catch (e) { res.push({ name: l.entry.name, err: String(e).slice(0, 120) }); }
  }
  return res;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
