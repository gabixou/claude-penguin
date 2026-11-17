import { chromium } from 'playwright-core';
import { rmSync } from 'node:fs';
// Testa cache IDB de layers ENTRE sessoes: perfil persistente, 2 launches.
// Launch 1: carrega dance (cold). Launch 2: dance deve vir do IDB.
const profile = 'tools/.idb-profile';
rmSync(profile, { recursive: true, force: true });

const launch = () => chromium.launchPersistentContext(profile, {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    viewport: { width: 1280, height: 800 },
});

const goDance = async (ctx, label) => {
    const p = ctx.pages()[0] || await ctx.newPage();
    p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)));
    const t0 = Date.now();
    await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
    console.log(label + ' boot town:', ((Date.now() - t0) / 1000).toFixed(2) + 's');
    const s = Date.now();
    await p.evaluate(() => { const sc = window.__penguin.scene; sc._movieReady = false; sc.changeRoom('dance'); });
    await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
    console.log(label + ' ->dance:', ((Date.now() - s) / 1000).toFixed(2) + 's');
    return p;
};

// sessao 1: popula IDB
let ctx = await launch();
await goDance(ctx, 'sessao1');
await ctx.close();

// sessao 2: IDB quente
ctx = await launch();
await goDance(ctx, 'sessao2');
await ctx.close();
