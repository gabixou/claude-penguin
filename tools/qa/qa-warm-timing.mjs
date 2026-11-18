// Mede: (1) duracao do warmFrames ate _warmDone, (2) latencia media de
// view.render() durante a dance, (3) frames desenhados no 1o segundo.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
const LOOK = { head: 407, face: 123, neck: 170, body: 221, hand: 15017, feet: 374 };
const r = await page.evaluate(`(async () => {
    const s = ${scene};
    const v = s.localPlayer.view;
    s.localPlayer.setColorItemId(7);
    const t0 = performance.now();
    v.setLook(${JSON.stringify(LOOK)});
    for (let i = 0; i < 300; i++) { if (!(v._pendingItems > 0)) break; await new Promise(r => setTimeout(r, 100)); }
    const equipMs = performance.now() - t0;
    // espera warmDone (max 180s)
    let warmMs = null;
    for (let i = 0; i < 1800; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (v._warmDone) { warmMs = performance.now() - t0; break; }
    }
    // dance: mede latencia de render real
    s.handleAction('dance');
    const renders = [];
    const orig = v.render.bind(v);
    v.render = async (...a) => { const t = performance.now(); try { return await orig(...a); } finally { renders.push(performance.now() - t); } };
    await new Promise(r => setTimeout(r, 3000));
    renders.sort((a,b)=>a-b);
    const n = renders.length;
    return { equipMs: +equipMs.toFixed(0), warmMs: warmMs && +warmMs.toFixed(0),
             rendersIn3s: n, p50: n? +renders[Math.floor(n/2)].toFixed(1):null,
             p95: n? +renders[Math.floor(n*0.95)].toFixed(1):null,
             max: n? +renders[n-1].toFixed(1):null };
})()`);
console.log(JSON.stringify(r));
await browser.close();
