import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0,200)); });
p.on('pageerror', e => errors.push('PAGEERROR: ' + String(e.stack||e).slice(0,600)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(14000);
const r = await p.evaluate(() => {
  const lp = window.__penguin;
  return {
    hasView: !!lp?.view,
    frame: lp?.action,
    pos: lp ? { x: lp.x, y: lp.y } : null,
    libBounds: lp?._lib?.bounds,
    viewW: lp?._lib?.viewW, viewH: lp?._lib?.viewH,
    canvas: lp && lp._canvas ? [lp._canvas.width, lp._canvas.height] : null,
    look: lp?.view?.look,
    items: lp?.view ? [...lp.view.items.keys()] : [],
  };
});
console.log(JSON.stringify(r, null, 1));
console.log('ERRORS:', JSON.stringify(errors.slice(0,15), null, 1));
await b.close();
