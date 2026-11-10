import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('[err]', String(e).slice(0, 200)));
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
await p.screenshot({ path: 'shots/ref-shop.png' });
// dump botoes/controles DOM visiveis
const ctrls = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, [role="button"], .control, [class*="control"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push({ t: (el.textContent || '').trim().slice(0, 60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) });
  });
  return out.slice(0, 60);
});
console.log(JSON.stringify(ctrls, null, 1));
await b.close();
