import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.catalogue?.open('clothing'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
const r = await p.evaluate(async () => {
  const m = window.__penguin.scene.catalogue.movie;
  const out = {};
  for (const f of ['241.svg', '244.svg', '246.svg', '247.svg']) {
    const txt = m._svgText(f);
    out[f] = { svgLen: txt ? txt.length : null, ref: m.files.get(f) ? 'ok' : 'NOREF' };
    const imgP = m._svgImage(f);
    const img = await imgP;
    out[f].img = img ? (img.naturalWidth + 'x' + img.naturalHeight) : 'NULL';
    const ch = m.characters[f.replace('.svg', '')];
    const cv = await m.artCanvas(f, ch, 2);
    if (cv) {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let px = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) px++;
      out[f].cvPx = px; out[f].cvSize = cv.width + 'x' + cv.height;
    } else out[f].cv = 'NULL';
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
