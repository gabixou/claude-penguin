import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('tools/.idb-profile', {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, viewport: { width: 1280, height: 800 },
});
const p = ctx.pages()[0] || await ctx.newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
const info = await p.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('penguin-movie', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const store = db.transaction('penguin-movie-layers').objectStore('penguin-movie-layers');
    const keys = await new Promise((res) => { const r = store.getAllKeys(); r.onsuccess = () => res(r.result); });
    const out = [];
    for (const k of keys) {
        const v = await new Promise((res) => { const r = store.get(k); r.onsuccess = () => res(r.result); });
        out.push({ k: String(k).slice(0, 80), layers: v?.layers?.length, dyns: v?.dyns?.length, blobs: v?.blobs?.length, bytes: JSON.stringify(v)?.length });
    }
    return out;
});
console.log(JSON.stringify(info, null, 1));
await ctx.close();
