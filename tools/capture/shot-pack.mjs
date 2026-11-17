import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2] || 'http://localhost:3000/?room=town&moviepack=hptown';
const out = process.argv[3] || 'E:\\project\\cp-halloween-swfs\\shot.png';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
p.on('requestfailed', r => console.log('[reqfail]', r.url().slice(-80)));
await p.goto(url, { waitUntil: 'domcontentloaded' });
// espera a sala ficar pronta de verdade (_movieReady)
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 });
} catch {}
await p.waitForTimeout(3000);
// loader pode ficar ate os planos do ciclo ficarem prontos (entrar em
// zona de transicao segura o reveal) — espera ele sumir de verdade
try {
  await p.waitForFunction(() => {
    const s = window.__penguin?.scene;
    return s && (!s.loadingScreen || s.loadingScreen._mode === null || s.loadingScreen.visible === false);
  }, { timeout: 60000 });
} catch {}
await p.waitForTimeout(500);
const info = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  return { movie: !!s?.movie, pack: s?.movie?.base, room: s?.currentRoom };
});
console.log(JSON.stringify(info));
await p.screenshot({ path: out });
await b.close();
console.log('shot ->', out);
