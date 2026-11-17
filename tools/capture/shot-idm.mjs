import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('tools/.idb-profile', {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, viewport: { width: 1280, height: 800 },
});
const p = ctx.pages()[0] || await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 150)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.evaluate(() => { const sc = window.__penguin.scene; sc._movieReady = false; sc.changeRoom('dance'); });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500); // deixa dyns animarem p/ confirmar que repaintam
await p.screenshot({ path: 'tools/shots/clone-dance-idbcache.png' });
await ctx.close();
