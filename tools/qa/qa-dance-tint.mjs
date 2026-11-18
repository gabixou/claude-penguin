// Apos warm: dance 4s — conta tintedCanvas/artCanvas misses e latencia.
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
    v.setLook(${JSON.stringify(LOOK)});
    for (let i = 0; i < 300; i++) { if (!(v._pendingItems > 0)) break; await new Promise(r => setTimeout(r, 100)); }
    for (let i = 0; i < 400; i++) { if (v._warmDone) break; await new Promise(r => setTimeout(r, 100)); }
    const warmDone = !!v._warmDone;
    // instrumenta movies
    const movies = [v.lib.movie, ...[...v.items.values()].map(i=>i.m)];
    const seen = new Set(); const st = { tint: 0, art: 0, sheet: 0 };
    for (const m of movies) {
        if (!m || seen.has(m)) continue; seen.add(m);
        const ot = m.tintedCanvas?.bind(m); if (ot) m.tintedCanvas = (...a) => { st.tint++; return ot(...a); };
        const oa = m.artCanvas?.bind(m); if (oa) m.artCanvas = (...a) => { st.art++; return oa(...a); };
        const osh = m._atlasSheet?.bind(m); if (osh) m._atlasSheet = (...a) => { st.sheet++; return osh(...a); };
    }
    s.handleAction('dance');
    const lat = [];
    const orig = v.render.bind(v);
    v.render = async (...a) => { const t = performance.now(); try { return await orig(...a); } finally { lat.push(performance.now()-t); } };
    await new Promise(r => setTimeout(r, 4000));
    lat.sort((a,b)=>a-b);
    const n = lat.length;
    return { warmDone, renders: n, tintCalls: st.tint, artCalls: st.art, sheetCalls: st.sheet,
             p50: n?+lat[Math.floor(n/2)].toFixed(1):null, p95: n?+lat[Math.floor(n*.95)].toFixed(1):null, max: n?+lat[n-1].toFixed(1):null };
})()`);
console.log(JSON.stringify(r));
await browser.close();
