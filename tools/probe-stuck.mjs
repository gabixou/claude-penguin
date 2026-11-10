import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(2000);
  const st = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    if (!s) return null;
    const layers = s.movieLayers || [];
    const busy = layers.filter(l => l._busy).length;
    // conta imagens SVG pendentes no cache do movie da sala
    let pending = -1, total = -1;
    try {
      const mc = s.movie?._imgCache;
      if (mc) { total = mc.size; pending = [...mc.values()].filter(v => v instanceof Promise).length; }
    } catch {}
    return {
      ready: !!s._movieReady,
      progress: s.loadingScreen?._progress,
      busy,
      imgPromises: pending,
      imgTotal: total,
      dirty: s.movie?._dirtyRoots?.size,
      playheads: s.movie?._playheadAll?.size,
    };
  }).catch(() => null);
  console.log(`t=${(i + 1) * 2}s`, JSON.stringify(st));
  if (st?.ready) break;
}
await b.close();
