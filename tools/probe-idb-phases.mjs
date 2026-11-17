import { chromium } from 'playwright-core';
// Perfil persistente ja populado pelo probe-idb — mede fases do load quente.
const profile = 'tools/.idb-profile';
const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    viewport: { width: 1280, height: 800 },
});
const p = ctx.pages()[0] || await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
// instrumenta metodos da scene
await p.evaluate(() => {
    const sc = window.__penguin.scene;
    window.__ph = {};
    for (const m of ['_setupDynamics', '_buildMovieLayers', '_renderDynamics', '_renderSegment']) {
        const orig = sc[m].bind(sc);
        sc[m] = async (...a) => {
            const t = performance.now();
            try { return await orig(...a); }
            finally { (window.__ph[m] = window.__ph[m] || []).push(+(performance.now() - t).toFixed(0)); }
        };
    }
    const origLoad = Object.getPrototypeOf(sc.movie.constructor).load;
    window.__ph.load = [];
    // MovieRoom.load e estatico — wrap via constructor
    const MR = sc.movie.constructor;
    const ol = MR.load.bind(MR);
    MR.load = async (...a) => { const t = performance.now(); try { return await ol(...a); } finally { window.__ph.load.push(+(performance.now() - t).toFixed(0)); } };
});
await p.evaluate(() => { const sc = window.__penguin.scene; sc._movieReady = false; sc.changeRoom('dance'); });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
const ph = await p.evaluate(() => window.__ph);
console.log(JSON.stringify(ph, null, 1));
await ctx.close();
