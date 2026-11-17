import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
await page.evaluate(`(() => { const s = ${scene}; s.handleAction('dance'); })()`);
await page.waitForTimeout(8000);
const info = await page.evaluate(`(async () => {
    const s = ${scene};
    const p = s.localPlayer;
    const v = p.view;
    const out = {
        hasView: !!v, frame: v?.frame, drawn: v?.drawnFrame,
        actions: v?._actions ? v._actions.size : -1,
        libMovieAtlas: !!v?.lib?.movie?._atlas,
        libActionMovies: v?.lib?._actionMovies ? v.lib._actionMovies.size : -1,
    };
    // amostra um action movie carregado
    if (v?._actions?.size) {
        const [af, a] = [...v._actions.entries()][0];
        out.sampleAf = af; out.sampleClip = !!a.clip; out.sampleFailed = !!a.failed;
    }
    const mv = v?.lib?._actionMovies ? [...v.lib._actionMovies.values()][0] : null;
    if (mv) {
        const m = await mv;
        out.mvAtlas = !!m?._atlas;
        out.mvAtlasFrames = m?._atlas ? Object.keys(m._atlas.frames).length : 0;
        out.mvBase = m?.base;
        if (m?._atlas) {
            const sh = await m._atlasSheet(0);
            out.sheet0 = !!sh; out.sheetW = sh?.naturalWidth;
        }
    }
    return out;
})()`);
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: 'tools/shots/atlas-dance3.png' });
await browser.close();
