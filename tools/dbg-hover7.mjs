// dbg-hover7.mjs — repro do bug: primary=night, plano visivel=day
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await p.goto(url, { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
// espera os planos alternativos ficarem prontos
try { await p.waitForFunction(() => Object.keys(window.__penguin?.scene?._planes || {}).length >= 2, { timeout: 120000 }); } catch {}
await p.waitForTimeout(1000);
const st0 = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  return { pack: s.movie?.base, kind: s._primaryKind, planes: Object.keys(s._planes || {}) };
});
console.log('load:', JSON.stringify(st0));
// forca o plano DIA como visivel (simula relogio ter virado)
await p.evaluate(() => {
  const s = window.__penguin?.scene;
  s._zoneWeightsNow = () => ({ day: 1, twilight: 0, night: 0, dim: 0, bottom: 'day', top: null });
  s._applyZoneWeights();
});
await p.waitForTimeout(300);
// hoverAt direto no centro do dance_btn (coords de mundo)
const r = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const ia = s._interactions;
  const btn = ia?.buttons?.find((x) => /dance_btn/.test(x.path));
  if (!btn) return { err: 'sem botao' };
  const cx = (btn.bounds[0] + btn.bounds[2]) / 2, cy = (btn.bounds[1] + btn.bounds[3]) / 2;
  ia.hoverAt(cx, cy);
  const vm = s._visibleMovie();
  const h = vm && [...vm._playheads.entries()].find(([k]) => k === 'dance_canopy_mc');
  return {
    visiblePack: vm?.base,
    hovered: ia.hovered,
    canopyDayPlane: h ? { frame: h[1].frame, stopped: h[1].stopped } : 'sem playhead',
  };
});
console.log('hover->visibleMovie:', JSON.stringify(r));
await b.close();
