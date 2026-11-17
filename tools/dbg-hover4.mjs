// dbg-hover4.mjs <url> — descobre o mapeamento pointer.worldX real
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
await p.goto(url, { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
await p.waitForTimeout(2500);
await p.evaluate(() => {
  const s = window.__penguin?.scene;
  window.__moves = [];
  s.input.on('pointermove', (ptr) => {
    if (window.__moves.length < 40) window.__moves.push({ x: ptr.x, y: ptr.y, wx: ptr.worldX, wy: ptr.worldY });
  });
});
// varre a tela em grade pra achar onde worldX/Y caem nos botoes
for (const [sx, sy] of [[700, 400], [780, 380], [800, 420], [760, 350], [850, 400]]) {
  await p.mouse.move(sx, sy);
  await p.waitForTimeout(120);
}
const moves = await p.evaluate(() => window.__moves.slice(-8));
console.log(JSON.stringify(moves, null, 1));
const cam = await p.evaluate(() => {
  const c = window.__penguin?.scene?.cameras?.main;
  return c ? { zoom: c.zoom, scrollX: c.scrollX, scrollY: c.scrollY, w: c.width, h: c.height } : null;
});
console.log('camera:', JSON.stringify(cam));
await b.close();
