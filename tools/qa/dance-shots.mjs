import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const MODE = process.argv[2] || 'composed';
const N = parseInt(process.argv[3] || '4', 10);
const USERS = ['Arenovisk', 'Penguin_ZDNT', 'OldSmokeGuest', 'Penguin_63GM'];
const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pages = [];
for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1039, height: 551 } });
    const pg = await ctx.newPage();
    pages.push(pg);
    await pg.goto(`http://localhost:3000/?room=dance&penguin=${USERS[i % USERS.length]}`, { waitUntil: 'domcontentloaded' });
}
// espera todas estarem na sala com views prontas
const deadline = Date.now() + 90000;
let ready = 0;
while (Date.now() < deadline && ready < N) {
    ready = 0;
    for (const pg of pages) {
        try {
            const ok = await pg.evaluate(() => {
                const g = window.__game || window.game;
                const scene = Object.values(g.scene.keys).find((s) => s.localPlayer?.view);
                return !!scene?.localPlayer?.view && (scene.remotePlayers?.size ?? 0) >= 0;
            });
            if (ok) ready++;
        } catch {}
    }
    if (ready < N) await pages[0].waitForTimeout(3000);
}
console.log('ready pages:', ready);
// dance em todas
for (const pg of pages) {
    await pg.evaluate(() => {
        const g = window.__game || window.game;
        const scene = Object.values(g.scene.keys).find((s) => s.localPlayer?.playEmote);
        scene?.handleAction?.('dance');
    }).catch(() => {});
}
// espera uns segundos de dance e tira screenshots em momentos diferentes
await pages[0].waitForTimeout(6000);
await pages[0].screenshot({ path: `tools/shots/dance-live-${MODE}-a.png` });
await pages[0].waitForTimeout(1500);
await pages[0].screenshot({ path: `tools/shots/dance-live-${MODE}-b.png` });
await pages[0].waitForTimeout(1500);
await pages[0].screenshot({ path: `tools/shots/dance-live-${MODE}-c.png` });
// estado dos pinguins
const st = await pages[0].evaluate(() => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.localPlayer && s.remotePlayers);
    const all = [scene.localPlayer, ...scene.remotePlayers.values()];
    return all.map((p) => ({ u: p.username, a: p.action, vf: p.view?.frame, df: p.view?.drawnFrame }));
});
console.log(JSON.stringify(st));
await browser.close();
process.exit(0);
