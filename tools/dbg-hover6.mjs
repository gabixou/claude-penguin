// dbg-hover6.mjs <url> — hover real: resolve transform screen->world com 2 probes
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
await p.goto(url, { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
await p.waitForTimeout(3000);
// 2 probes -> transform affine world = a*screen + c
const probe = async (sx, sy) => {
  await p.mouse.move(sx, sy);
  await p.waitForTimeout(120);
  return p.evaluate(() => {
    const s = window.__penguin?.scene;
    return { wx: s._pointerWorld.x, wy: s._pointerWorld.y };
  });
};
const w1 = await probe(400, 300);
const w2 = await probe(900, 600);
const ax = (w2.wx - w1.wx) / (900 - 400), ay = (w2.wy - w1.wy) / (600 - 300);
const cx = w1.wx - ax * 400, cy = w1.wy - ay * 300;
console.log('transform: wx=' + ax.toFixed(3) + '*sx+' + cx.toFixed(1) + ' wy=' + ay.toFixed(3) + '*sy+' + cy.toFixed(1));
// alvo = centro do dance_btn
const tgt = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const btn = s?._interactions?.buttons?.find((x) => /dance_btn/.test(x.path));
  return btn ? { x: (btn.bounds[0] + btn.bounds[2]) / 2, y: (btn.bounds[1] + btn.bounds[3]) / 2 } : null;
});
if (tgt) {
  const sx = (tgt.x - cx) / ax, sy = (tgt.y - cy) / ay;
  console.log('alvo screen:', sx.toFixed(0), sy.toFixed(0));
  await p.mouse.move(sx, sy, { steps: 4 });
  await p.waitForTimeout(1200);
}
const fin = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const m = s?.movie;
  const h = [...(m?._playheads || new Map()).entries()].find(([k]) => k === 'dance_canopy_mc');
  return {
    hovered: s?._interactions?.hovered,
    pw: s?._pointerWorld,
    btnStates: [...(m?._buttonStates || new Map()).entries()],
    canopy: h ? { frame: h[1].frame, stopped: h[1].stopped } : null,
  };
});
console.log('FINAL:', JSON.stringify(fin));
await p.screenshot({ path: 'E:\\project\\cp-halloween-swfs\\hov-real.png' });
await b.close();
