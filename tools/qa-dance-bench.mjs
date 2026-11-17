// Benchmark dance COM ROUPAS: outfit cuja assinatura mapeia frame 26 ->
// penguin-actions/133 (neck:3032 coberto localmente; demais ids fora dos
// packs clothing/ — gap conhecido, corpo+neck animam).
// Baseline anterior (SVG): ~6.2s primeiro frameReady (docs/visual-review-dance-freeze).
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)));
const atlasPng = [];
page.on('request', (r) => { const u = r.url(); if (/atlas-\d+\.png/.test(u)) atlasPng.push(u.split('/assets/')[1]); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;

const LOOK = { head: 1581, face: 2119, neck: 3032, body: 4834, hand: 0, feet: 6163 };
const equip = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    const t0 = performance.now();
    v.setLook(${JSON.stringify(LOOK)});
    for (let i = 0; i < 150; i++) {
        if (!(v._pendingItems > 0)) break;
        await new Promise(r => setTimeout(r, 100));
    }
    // sanity: animationFrame(26) deve dar >76
    const af = v.lib.animationFrame(v.look, 26);
    return { equipMs: +(performance.now() - t0).toFixed(0), pending: v._pendingItems || 0, af };
})()`);
console.log('equip:', JSON.stringify(equip));
await page.waitForTimeout(1000);

const dance = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    const t0 = performance.now();
    s.handleAction('dance');
    let clipMs = null, drawnMs = null;
    for (let i = 0; i < 800; i++) {
        await new Promise(r => setTimeout(r, 50));
        const now = performance.now() - t0;
        if (clipMs === null && [...(v._actions?.values() || [])].some(a => a.clip)) clipMs = now;
        if (drawnMs === null && v.drawnFrame > 76) drawnMs = now;
        if (drawnMs !== null && now > drawnMs + 800) break;
        if (now > 40000) break;
    }
    return {
        firstActionClipMs: clipMs && +clipMs.toFixed(0),
        firstDrawnActionMs: drawnMs && +drawnMs.toFixed(0),
        drawnFrame: v.drawnFrame,
        actionMovies: v.lib?._actionMovies ? v.lib._actionMovies.size : 0,
        items: v.items.size,
    };
})()`);
console.log('dance:', JSON.stringify(dance));
console.log('atlas pngs unique:', [...new Set(atlasPng)].length);
const byBase = {};
for (const u of atlasPng) { const b = u.split('/chars/')[0]; byBase[b] = (byBase[b] || 0) + 1; }
console.log(byBase);
await page.screenshot({ path: 'tools/shots/atlas-dance-clothed.png' });
await browser.close();
