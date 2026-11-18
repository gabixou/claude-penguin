import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
const r = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue;
    cat.open('furn2008_catalogue');
    await new Promise(r2 => setTimeout(r2, 6000));
    cat.movie.goto('book', 4);
    await cat._show();
    await new Promise(r2 => setTimeout(r2, 1200));
    const m = cat.movie;
    const body = m.data.buttonActions?.['213']?.release;
    const fn = cat._commands(body, '');
    const out = { body, hasFn: !!fn };
    // simula a logica interna do ops
    const ops = [...body.matchAll(/([\\w.]*?)(nextFrame|prevFrame|gotoAndStop|gotoAndPlay)\\(\\s*(?:(\\d+)|"([^"]+)")?\\s*\\)/g)];
    out.ops = ops.map(o => ({ r: o[1], l: o[2], c: o[3], d: o[4] }));
    const r0 = ops[0];
    const f = cat._target('', r0[1]);
    const u = m.find(f);
    out.f = f; out.u = u ? { path: u.path, id: u.id, main: u.main } : null;
    out.mExists = !!m.data.sprites?.[u?.id];
    out.total = u?.main ? m._mainTl?.frames?.length : m.data.sprites?.[u?.id]?.frames?.length;
    out.cur = m.currentFrame(f);
    // chama o action direto
    fn();
    await new Promise(r2 => setTimeout(r2, 600));
    out.afterFn = m.currentFrame('secret');
    return out;
})()`);
console.log(JSON.stringify(r, null, 1));
await browser.close();
