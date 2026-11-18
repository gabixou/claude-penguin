// Mede a DANCA de verdade: tempo do handleAction ate o playhead entrar
// nos frames de dance e completar um ciclo, com look do Arenovisk.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
let atlasBytes = 0, atlasCount = 0;
page.on('response', async (r) => {
    const u = r.url();
    if (/atlas-\d+\.png/.test(u)) { atlasCount++; try { atlasBytes += (await r.body()).length; } catch {} }
});
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;

const LOOK = { head: 407, face: 123, neck: 170, body: 221, hand: 15017, feet: 374 };
await page.evaluate(`(async () => {
    const s = ${scene};
    s.localPlayer.setColorItemId(7);
    s.localPlayer.view.setLook(${JSON.stringify(LOOK)});
    for (let i = 0; i < 300 && s.localPlayer.view._pendingItems > 0; i++) await new Promise(r => setTimeout(r, 100));
})()`);
await page.waitForTimeout(1500); // warmFrames

const res = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    const t0 = performance.now();
    const frames = [];
    s.handleAction('dance');
    let danceStart = null, danceEnd = null, maxFrame = 0;
    for (let i = 0; i < 2400; i++) {
        await new Promise(r => setTimeout(r, 25));
        const now = performance.now() - t0;
        const f = v.drawnFrame;
        if (f > maxFrame) maxFrame = f;
        frames.push(f);
        // dance = frames > 26 na timeline principal (idle/walk ficam < 26)
        if (danceStart === null && f > 26) danceStart = now;
        if (danceStart !== null && danceEnd === null && f <= 26 && now > danceStart + 500) danceEnd = now;
        if (danceEnd !== null) break;
        if (now > 90000) break;
    }
    return {
        danceStartMs: danceStart && +danceStart.toFixed(0),
        danceEndMs: danceEnd && +danceEnd.toFixed(0),
        maxFrame, totalMs: +(performance.now() - t0).toFixed(0),
        uniqFrames: [...new Set(frames)].length,
        pendingArt: v.lib?.itemClip ? 'n/a' : 0,
    };
})()`);
console.log('dance:', JSON.stringify(res));
console.log('atlas sheets:', atlasCount, 'bytes:', (atlasBytes / 1048576).toFixed(1) + 'MB');
await page.screenshot({ path: 'tools/shots/atlas-dance2.png' });
await browser.close();
