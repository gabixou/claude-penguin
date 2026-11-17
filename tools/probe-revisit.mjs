import { chromium } from 'playwright-core';
// Probe de revisita: mede _movieReady por troca de sala (cold vs warm).
const URL = 'http://localhost:3000/?penguin=Arenovisk';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));

const gotoRoom = async (room) => {
    const t0 = Date.now();
    await p.evaluate((r) => {
        const s = window.__penguin.scene;
        s.changeRoom(r, null, null);
    }, room);
    await p.waitForFunction((r) => {
        const s = window.__penguin.scene;
        return s.currentRoom === r && s._movieReady === true;
    }, room, { timeout: 120000 });
    return (Date.now() - t0) / 1000;
};

await p.goto(URL, { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
console.log('BOOT town (cold):', ((Date.now() - t0) / 1000).toFixed(1) + 's');
await p.waitForTimeout(2500); // settle + warm idle

console.log('town -> dance:', (await gotoRoom('dance')).toFixed(2) + 's');
await p.waitForTimeout(1500);
console.log('dance -> town:', (await gotoRoom('town')).toFixed(2) + 's');
await p.waitForTimeout(1500);
console.log('town -> dance:', (await gotoRoom('dance')).toFixed(2) + 's');
await p.waitForTimeout(1500);
console.log('dance -> town:', (await gotoRoom('town')).toFixed(2) + 's');

const info = await p.evaluate(() => ({
    shared: window.__penguin.scene.constructor ? undefined : undefined,
    // MovieRoom._sharedAssets via módulo — acessível? não exportado p/ window.
    // mede via performance: quantas entries? proxy: contam os fetches?
}));
console.log(JSON.stringify(info));
await b.close();
