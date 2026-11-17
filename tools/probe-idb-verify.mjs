import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('tools/.idb-profile', {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, viewport: { width: 1280, height: 800 },
});
const p = ctx.pages()[0] || await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
// troca pra dance cronometrando
const s = Date.now();
await p.evaluate(() => { const sc = window.__penguin.scene; sc._movieReady = false; sc.changeRoom('dance'); });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('dance load:', ((Date.now() - s) / 1000).toFixed(2) + 's');
const st = await p.evaluate(async () => {
    const sc = window.__penguin.scene;
    const db = await new Promise((res) => { const r = indexedDB.open('penguin-movie', 1); r.onsuccess = () => res(r.result); });
    const store = db.transaction('penguin-movie-layers').objectStore('penguin-movie-layers');
    const keys = await new Promise((res) => { const r = store.getAllKeys(); r.onsuccess = () => res(r.result); });
    const k = keys.find(k => String(k).startsWith('v3|dance'));
    const v = await new Promise((res) => { const r = store.get(k); r.onsuccess = () => res(r.result); });
    return {
        sceneLayers: sc.movieLayers?.length,
        sceneDyns: sc._dynList?.length,
        cacheLayers: v?.layers?.length,
        cacheDyns: v?.dyns?.length,
        cacheKey: String(k),
        dynBlobNulls: (v?.dyns || []).filter(b => !b).length,
        layerBlobNulls: (v?.layers || []).filter(b => !b).length,
    };
});
console.log(JSON.stringify(st, null, 1));
await ctx.close();
