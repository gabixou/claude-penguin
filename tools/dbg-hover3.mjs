// dbg-hover3.mjs <url> — chama hoverAt direto com coords de mundo
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await p.goto(url, { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const ia = s?._interactions;
  const btn = ia?.buttons?.find((b) => /dance_btn/.test(b.path));
  if (!btn) return { err: 'sem botao', n: ia?.buttons?.length };
  const [x0, y0, x1, y1] = btn.bounds;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hit = ia.buttonAt(cx, cy);
  ia.hoverAt(cx, cy);
  return {
    btn: btn.path, bounds: btn.bounds, cx, cy,
    hit: hit?.path || null,
    hovered: ia.hovered,
    states: [...(s.movie._buttonStates || new Map()).entries()],
    forced: [...(s.movie._forcedPaths || [])],
  };
});
console.log(JSON.stringify(r, null, 1));
await p.waitForTimeout(1500);
const r2 = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const m = s?.movie;
  const h = [...(m?._playheads || new Map()).entries()].find(([k]) => k === 'dance_canopy_mc' || k.endsWith('.dance_canopy_mc'));
  return { canopy: h ? { k: h[0], frame: h[1].frame, stopped: h[1].stopped } : null,
           dirtyF: [...(m?._dirtyForcedPaths || [])] };
});
console.log('tick depois:', JSON.stringify(r2));
await p.screenshot({ path: 'E:\\project\\cp-halloween-swfs\\hov-day2.png' });
await b.close();
