import { chromium } from 'playwright-core';
// Mede a latencia de view.render() durante o primeiro walk pos-load.
// Slide = renders esperando decode de SVG (latencia alta / frames perdidos).
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => {
    const lp = window.__penguin?.scene?.localPlayer;
    return lp?.view && lp.view.drawnFrame > 0;
}, null, { timeout: 30000 });

// instrumenta render: latencia de cada chamada
await p.evaluate(() => {
    const lp = window.__penguin.scene.localPlayer;
    window.__renders = [];
    const orig = lp.view.render.bind(lp.view);
    lp.view.render = async (ctx, scale) => {
        const t = performance.now();
        try { return await orig(ctx, scale); }
        finally { window.__renders.push(+(performance.now() - t).toFixed(1)); }
    };
    const s = window.__penguin.scene;
    s.localPlayer.moveTo(s.localPlayer.x + 400, s.localPlayer.y - 200, 150);
});

await p.waitForTimeout(4000);
const stats = await p.evaluate(() => {
    const r = window.__renders;
    const sorted = [...r].sort((a, b) => a - b);
    return {
        n: r.length,
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        over100: r.filter(x => x > 100).length,
        over300: r.filter(x => x > 300).length,
        first10: r.slice(0, 10),
    };
});
console.log(JSON.stringify(stats, null, 1));
await b.close();
