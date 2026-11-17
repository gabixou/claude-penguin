import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('console', m => console.log('[' + m.type() + ']', m.text().slice(0, 200)));
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto(url, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 8; i++) {
  await p.waitForTimeout(10000);
  const st = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    return {
      ready: s?._movieReady, booting: s?._booting,
      layers: s?.movieLayers?.length,
      vis: s?.movieLayers?.map(l => l.img?.visible),
      lsVisible: s?.loadingScreen?.visible,
      lsAlpha: s?.loadingScreen?.alpha,
    };
  }).catch(e => ({ err: String(e).slice(0, 100) }));
  console.log(`t=${(i + 1) * 10}s`, JSON.stringify(st));
}
await p.screenshot({ path: 'E:\\project\\cp-halloween-swfs\\diag2.png' });
await b.close();
