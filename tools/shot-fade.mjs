import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2] || 'http://localhost:3100/?room=town&daynight=day';
const tag = process.argv[3] || 'fade';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
await p.goto(url, { waitUntil: 'domcontentloaded' });
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 });
} catch {}
// espera o plano noturno ficar pronto
try {
  await p.waitForFunction(() => !!window.__penguin?.scene?._alt, { timeout: 90000 });
} catch { console.log('alt nao ficou pronto'); }
await p.waitForTimeout(1500);
const info = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  return { movie: !!s?.movie, pack: s?.movie?.base, room: s?.currentRoom,
           phase: s?._phase, alt: !!s?._alt,
           altSegs: s?._alt?.segs?.length, altDyns: s?._alt?.dyns?.length };
});
console.log('before:', JSON.stringify(info));
await p.screenshot({ path: `E:\\project\\cp-halloween-swfs\\${tag}-day.png` });
// dispara a transicao dia->noite
await p.evaluate(() => window.__penguin.scene._setPhase('night'));
await p.waitForTimeout(4000); // meio do fade
await p.screenshot({ path: `E:\\project\\cp-halloween-swfs\\${tag}-mid.png` });
await p.waitForTimeout(12000); // fim do fade
await p.screenshot({ path: `E:\\project\\cp-halloween-swfs\\${tag}-night.png` });
const info2 = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  return { phase: s?._phase, alt: !!s?._alt };
});
console.log('after:', JSON.stringify(info2));
await b.close();
