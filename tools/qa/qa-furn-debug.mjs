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
    const m = cat.movie;
    const { entries } = m.collectInteractive();
    const e213 = entries.filter(e => e.id === 213 || /213|secret/.test(e.path));
    const ch213 = m.characters['213'];
    const ch199 = m.characters['199'];
    return {
        nEntries: entries.length,
        e213: e213.map(e => ({ path: e.path, id: e.id, bounds: e.bounds, acts: !!e.acts, name: e.name })),
        ch213: ch213 ? { kind: ch213.kind, recKeys: Object.keys(ch213.records||{}), upLen: ch213.records?.up?.length, htLen: ch213.records?.hittest?.length } : null,
        ch199: ch199 ? { kind: ch199.kind, file: ch199.file, size: ch199.size } : null,
        controls: cat.controls.map(c => ({ p: c.path, l: c.label })),
    };
})()`);
console.log(JSON.stringify(r, null, 1));
await browser.close();
