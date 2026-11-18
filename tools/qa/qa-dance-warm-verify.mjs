// Verifica o fix do warm: apos equip+warm completo, a dance NAO deve
// disparar novos downloads de atlas sheets (chars ja estao quentes).
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
const atlasUrls = new Set();
page.on('response', (r) => { if (/atlas-\d+\.png/.test(r.url())) atlasUrls.add(r.url()); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;

const LOOK = { head: 407, face: 123, neck: 170, body: 221, hand: 15017, feet: 374 };
const warm = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    s.localPlayer.setColorItemId(7);
    const t0 = performance.now();
    v.setLook(${JSON.stringify(LOOK)});
    for (let i = 0; i < 300 && v._pendingItems > 0; i++) await new Promise(r => setTimeout(r, 100));
    const equipMs = +(performance.now() - t0).toFixed(0);
    const w0 = performance.now();
    for (let i = 0; i < 1200 && !v._warmDone; i++) await new Promise(r => setTimeout(r, 100));
    return { equipMs, warmMs: +(performance.now() - w0).toFixed(0), warmDone: v._warmDone };
})()`);
console.log('equip+warm:', JSON.stringify(warm));
const before = atlasUrls.size;

const res = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    const p = s.localPlayer;
    const t0 = performance.now();
    s.handleAction('dance');
    let firstRenderMs = null;
    for (let i = 0; i < 2400; i++) {
        await new Promise(r => setTimeout(r, 25));
        if (firstRenderMs === null && p._rendering === false && v.dirty === false) { firstRenderMs = +(performance.now() - t0).toFixed(0); break; }
        if (performance.now() - t0 > 60000) break;
    }
    return { firstRenderMs, drawnFrame: v.drawnFrame };
})()`);
await page.waitForTimeout(2500);
console.log('dance:', JSON.stringify(res));
console.log('atlas sheets novos na dance:', atlasUrls.size - before);
await page.screenshot({ path: 'tools/shots/atlas-dance3.png' });
await browser.close();
