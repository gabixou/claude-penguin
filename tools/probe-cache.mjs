import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'town';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
async function waitReady(tag) {
  const t0 = Date.now();
  for (let i = 0; i < 300; i++) {
    const ok = await p.evaluate(() => {
      const s = window.__penguin && window.__penguin.scene;
      return !!(s && s._movieReady);
    }).catch(() => false);
    if (ok) { console.log(tag, 'ready em', ((Date.now() - t0) / 1000).toFixed(1) + 's'); return; }
    await p.waitForTimeout(1000);
  }
  console.log(tag, 'TIMEOUT');
}
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
await waitReady('1a-visita');
await p.reload({ waitUntil: 'domcontentloaded' });
await waitReady('2a-visita');
await b.close();
