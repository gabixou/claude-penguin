import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2] || 'http://localhost:3100/?room=town&daynight=dusk&zprog=0.25';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,300)));
p.on('console', m => { if (m.type()==='warning'||m.type()==='error') console.log('[con]', m.text().slice(0,200)); });
await p.goto(url, { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
// espera os planos do ciclo ficarem prontos (ate 90s) antes de medir
try {
  await p.waitForFunction(() => {
    const s = window.__penguin?.scene;
    return s && Object.keys(s._planes || {}).length >= 2 &&
      (s._primaryImgs?.()?.[0]?.alpha ?? 1) < 0.99;
  }, { timeout: 180000 });
} catch {}
await p.waitForTimeout(3000);
const info = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const w = s?._zoneWeightsNow?.();
  const planes = {};
  for (const [k, pl] of Object.entries(s?._planes || {})) {
    planes[k] = { segs: pl.segs.length, dyns: pl.dyns?.length, a0: pl.segs[0]?.img?.alpha, d0: pl.segs[0]?.img?.depth };
  }
  const pk = s?._primaryKind;
  const pi = s?._primaryImgs?.()?.[0];
  return { zone: s?._zone, zoneP: s?._zoneP, primary: pk, weights: w, planes,
           primaryImgAlpha: pi?.alpha, primaryImgDepth: pi?.depth };
});
console.log(JSON.stringify(info, null, 1));
const out = process.argv[3];
if (out) { await p.screenshot({ path: out }); console.log('shot ->', out); }
await b.close();
