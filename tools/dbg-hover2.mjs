// dbg-hover2.mjs <url> — simula hover real no botao e mede o efeito
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
// estado antes
const before = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const btns = s?._interactions?.buttons || [];
  return btns.map((b) => ({ path: b.path, bounds: b.bounds, walk: b.walk }));
});
console.log('botoes:', JSON.stringify(before));
// hover no primeiro botao (dance_btn ~ centro dos bounds)
const target = before.find((b) => /dance_btn/.test(b.path)) || before[0];
if (target) {
  const [x0, y0, x1, y1] = target.bounds;
  const ss = await p.evaluate(() => window.__penguin?.scene?._ss || 1);
  const cx = ((x0 + x1) / 2) * ss, cy = ((y0 + y1) / 2) * ss;
  console.log('hover em', target.path, '->', cx, cy, '(ss=' + ss + ')');
  await p.mouse.move(cx, cy, { steps: 5 });
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    const m = s?.movie;
    const h = m?._playheads?.get('dance_canopy_mc') || [...(m?._playheads||new Map()).entries()].find(([k]) => k === 'dance_canopy_mc' || k.endsWith('.dance_canopy_mc'))?.[1];
    return {
      hovered: s?._interactions?.hovered,
      btnState: m ? [...(m._buttonStates || new Map()).entries()] : [],
      canopyFrame: h?.frame, canopyStopped: h?.stopped,
      forced: [...(m?._forcedPaths || [])],
      dirtyF: [...(m?._dirtyForcedPaths || [])],
    };
  });
  console.log('depois:', JSON.stringify(after, null, 1));
  await p.screenshot({ path: 'E:\\project\\cp-halloween-swfs\\hov-day.png' });
}
await b.close();
