import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const room of ['coffee','plaza','dojo','mine','rink','forts','beach','dock','lodge','pizza','dance']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push(m.text().slice(0, 120)); });
  await p.goto(`http://localhost:3000/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(12000);
  const r = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    return { movie: !!s?.movie, layers: s?.movieLayers?.length ?? 0, pack: s?.movie?.base ?? null, swl: !!s?.swlScene };
  });
  console.log(room, JSON.stringify(r), errs.length ? 'ERRS: ' + errs.join(' | ') : '');
  await p.close();
}
await b.close();
