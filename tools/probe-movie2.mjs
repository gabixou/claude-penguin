import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
const r = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const m = s?.movie;
  if (!m) return { err: 'no movie' };
  // playheads de sprites com labels de idioma
  const lang = [];
  for (const [path, h] of m._playheads) {
    const l = h.tl.labels || {};
    if (l.english !== undefined) lang.push({ path, frame: h.frame, stopped: h.stopped });
  }
  // cobertura de pixels por layer
  const layers = (s.movieLayers || []).map((L, i) => {
    const c = L.canvas.getContext('2d').getImageData(0, 0, L.canvas.width, L.canvas.height).data;
    let n = 0;
    for (let j = 3; j < c.length; j += 40) if (c[j] > 10) n++;
    return { i, z: Math.round(L.img.depth), painted: n };
  });
  return { lang, layers, ss: s._ss, rate: m.rate };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
