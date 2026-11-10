import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
p.on('console', m => console.log('[' + m.type() + ']', m.text().slice(0, 200)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(15000);
const r = await p.evaluate(async () => {
  const out = {};
  try {
    const t0 = performance.now();
    const resp = await fetch('/assets/movies/town/timelines.json');
    out.tlStatus = resp.status;
    const tl = await resp.json();
    out.tlMs = Math.round(performance.now() - t0);
    out.packFile = tl.pack?.file;
    out.chunkFiles = tl.chunks?.files;
    // try loading one pack file
    const u = '/assets/movies/town/chars/' + tl.pack.file;
    const t1 = performance.now();
    const pr = await fetch(u);
    out.packStatus = pr.status;
    const buf = await pr.arrayBuffer();
    out.packBytes = buf.byteLength;
    out.packMs = Math.round(performance.now() - t1);
  } catch (e) { out.err = String(e); }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
