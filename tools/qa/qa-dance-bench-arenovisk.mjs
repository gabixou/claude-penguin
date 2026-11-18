// Benchmark dance com o look REAL do Arenovisk (DB): head 407, face 123,
// neck 170, body 221, hand 15017, feet 374 + color_item_id 7.
// Conta requests atlas vs pack/svg para detectar fallback.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
const atlasPng = [];
const packReq = [];
page.on('request', (r) => {
    const u = r.url();
    if (/atlas-\d+\.png/.test(u)) atlasPng.push(u.split('/assets/')[1]);
    else if (/\/chars\/chunk-.*\.pack/.test(u)) packReq.push(u.split('/assets/')[1]);
});
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;

const LOOK = { head: 407, face: 123, neck: 170, body: 221, hand: 15017, feet: 374 };
const equip = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    s.localPlayer.setColorItemId(7);
    const t0 = performance.now();
    v.setLook(${JSON.stringify(LOOK)});
    for (let i = 0; i < 300; i++) {
        if (!(v._pendingItems > 0)) break;
        await new Promise(r => setTimeout(r, 100));
    }
    const af = v.lib.animationFrame(v.look, 26);
    return { equipMs: +(performance.now() - t0).toFixed(0), pending: v._pendingItems || 0, af, items: v.items.size };
})()`);
console.log('equip:', JSON.stringify(equip));
await page.waitForTimeout(1000);

const dance = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    const t0 = performance.now();
    s.handleAction('dance');
    let clipMs = null, drawnMs = null;
    for (let i = 0; i < 1200; i++) {
        await new Promise(r => setTimeout(r, 50));
        const now = performance.now() - t0;
        if (clipMs === null && [...(v._actions?.values() || [])].some(a => a.clip)) clipMs = now;
        if (drawnMs === null && v.drawnFrame > 76) drawnMs = now;
        if (drawnMs !== null && now > drawnMs + 1200) break;
        if (now > 60000) break;
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
const byBase = {};
for (const u of atlasPng) { const b = u.split('/chars/')[0]; byBase[b] = (byBase[b] || 0) + 1; }
console.log('atlas pngs unique:', Object.keys(byBase).length, byBase);
const packsByBase = {};
for (const u of packReq) { const b = u.split('/chars/')[0]; packsByBase[b] = (packsByBase[b] || 0) + 1; }
console.log('pack reqs:', Object.keys(packsByBase).length, packsByBase);
await page.screenshot({ path: 'tools/shots/atlas-dance-arenovisk.png' });
await browser.close();
