import { chromium } from 'playwright-core';
// Profile do dance entry DEPOIS do prefetch idle — onde vao os ~40s?
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('town ready — aguardando 70s de prefetch idle');
await p.waitForTimeout(70000);

await p.evaluate(() => {
    const proto = Object.getPrototypeOf(window.__penguin.scene.movie);
    window.__st = {};
    const wrap = (name, key) => {
        const orig = proto[name];
        if (typeof orig !== 'function') return;
        window.__st[key || name] = { n: 0, ms: 0 };
        proto[name] = async function (...a) {
            const t = performance.now();
            try { return await orig.apply(this, a); }
            finally { const s = window.__st[key || name]; s.n++; s.ms += performance.now() - t; }
        };
    };
    wrap('_svgImage'); wrap('artCanvas'); wrap('tintedCanvas'); wrap('_drawShape'); wrap('renderLayer'); wrap('warmPlayheads'); wrap('buildCollision', 'collision'); wrap('prefetchSvgs'); wrap('prefetchFrames', 'prefFrames'); wrap('_setupDynamics', 'setupDyn');
    const sc = window.__penguin.scene;
    const sproto = Object.getPrototypeOf(sc);
    for (const m of ['_renderSegment', '_renderDynamics', '_setupDynamics', '_buildMovieLayers']) {
        const o = sproto[m];
        if (typeof o !== 'function') continue;
        window.__st['scene_' + m] = { n: 0, ms: 0 };
        sproto[m] = async function (...a) {
            const t = performance.now();
            try { return await o.apply(this, a); }
            finally { const s = window.__st['scene_' + m]; s.n++; s.ms += performance.now() - t; }
        };
    }
});

const t0 = Date.now();
await p.evaluate(() => window.__penguin.scene.changeRoom('dance', null, null));
await p.waitForFunction(() => {
    const s = window.__penguin.scene;
    return s.currentRoom === 'dance' && s._movieReady === true;
}, null, { timeout: 120000 });
console.log('dance entry total:', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const st = await p.evaluate(() => {
    const o = {};
    for (const [k, v] of Object.entries(window.__st)) o[k] = { n: v.n, ms: Math.round(v.ms) };
    return o;
});
console.log(JSON.stringify(st, null, 1));
await b.close();
