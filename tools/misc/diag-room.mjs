import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('console', m => { const t = m.text(); if (!t.includes('Download the React')) console.log('[' + m.type() + ']', t.slice(0, 160)); });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto(url, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 6; i++) {
  await p.waitForTimeout(10000);
  const st = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    const game = window.__penguin;
    return {
      scene: s?.scene?.key, room: s?.currentRoom,
      movie: !!s?.movie, ph: s?.movie?._playheads?.size,
      files: s?.movie?.files?.size, warm: s?.movie?._warm,
      canvases: document.querySelectorAll('canvas').length,
      loader: !!document.querySelector('.loader, #loader, [class*=load]'),
      bodyText: document.body?.innerText?.slice(0, 120),
    };
  }).catch(e => ({ err: String(e).slice(0, 100) }));
  console.log(`t=${(i + 1) * 10}s`, JSON.stringify(st));
}
await p.screenshot({ path: 'E:\\project\\cp-halloween-swfs\\diag.png' });
await b.close();
