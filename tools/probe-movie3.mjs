import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(9000);
const r = await p.evaluate(() => {
  const m = window.__penguin?.scene?.movie;
  if (!m) return { err: 'no movie' };
  const keys = [...m._playheads.keys()];
  return {
    total: keys.length,
    sign: keys.filter(k => /sign|coffee|gift|dance_btn/i.test(k)),
    sample: keys.slice(0, 15),
    // checa sprite 36 labels direto
    s36: JSON.stringify(m.sprites['36']?.labels),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
