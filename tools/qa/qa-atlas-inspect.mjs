import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
await page.evaluate(`(() => { const s = ${scene}; s.handleAction('dance'); })()`);
await page.waitForTimeout(6000);
// inspeciona PenguinArt: actionMovies -> _atlas?
const info = await page.evaluate(`(() => {
    const s = ${scene};
    const p = s.localPlayer;
    const view = p.view;
    const art = view?.lib;
    if (!art) return { err: 'no art', keys: view ? Object.keys(view) : null };
    const am = art?._actionMovies;
    const out = { actionMovies: am ? am.size : 0, items: art.itemsSize ? art.itemsSize : (art.items ? art.items.size : 0) };
    if (am && am.size) {
        const [af, pr] = [...am.entries()][0];
        out.sample = af;
        return Promise.resolve(pr).then((mv) => {
            out.hasAtlas = !!mv?._atlas;
            out.atlasFrames = mv?._atlas ? Object.keys(mv._atlas.frames).length : 0;
            out.base = mv?.base;
            // testa _atlasSheet
            return mv?._atlasSheet ? mv._atlasSheet(0).then((sh) => { out.sheet0 = !!sh; out.sheetW = sh?.naturalWidth; return out; }) : out;
        });
    }
    return out;
})()`);
console.log(JSON.stringify(info, null, 1));
await browser.close();
