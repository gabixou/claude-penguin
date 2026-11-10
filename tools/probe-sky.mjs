import { chromium } from 'playwright-core';
import fs from 'fs';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(15000);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const movie = scene.movie;
  if (!movie) return { err: 'no movie' };
  const layers = movie.topLevelLayers();
  const out = { nlayers: layers.length, names: layers.map(l => l.entry.name || ('#' + l.entry.id)) };
  // render background layer (find entry named background_mc) to offscreen canvas
  const layer = layers.find(l => l.entry.name === 'background_mc');
  if (!layer) return { ...out, err: 'no bg layer' };
  const cv = document.createElement('canvas');
  cv.width = 760; cv.height = 480;
  await movie.renderLayer(layer.entry, cv, 1);
  const ctx = cv.getContext('2d');
  const d = ctx.getImageData(0, 0, 760, 480).data;
  const avg = (x0, y0, w, h) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + h; y += 4) for (let x = x0; x < x0 + w; x += 4) {
      const i = (y * 760 + x) * 4;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    return [r / n, g / n, b / n].map(v => Math.round(v));
  };
  out.sky = avg(300, 10, 200, 60);
  out.mid = avg(300, 250, 200, 80);
  // count fully transparent px
  let transp = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] === 0) transp++;
  out.transpPct = Math.round(transp / (760 * 480) * 100);
  out.url = cv.toDataURL('image/png');
  return out;
});
if (r.url) fs.writeFileSync('tools/shots/movie-bg.png', Buffer.from(r.url.split(',')[1], 'base64'));
const { url, ...rest } = r;
console.log(JSON.stringify(rest, null, 1));
await b.close();
