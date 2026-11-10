import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('console', m => console.log('['+m.type()+']', m.text().slice(0,200)));
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
p.on('requestfailed', r => console.log('[reqfail]', r.url().slice(-80), r.failure()?.errorText));
p.on('response', r => { if (r.status() >= 400) console.log('['+r.status()+']', r.url().slice(-80)); });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
const r = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  if (!s) return { err: 'no scene' };
  return {
    movie: !!s.movie, layers: s.movieLayers?.length,
    pack: s.movie?.base,
    playheads: s.movie?._playheads?.size,
    files: s.movie?.files?.size,
    ss: s._ss,
  };
});
console.log(JSON.stringify(r));
await b.close();
