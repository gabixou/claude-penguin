// Perf E2E: N pinguins dançando na mesma sala — mede PenguinView.render()
// Uso: node tools/qa/dance-perf.mjs [nopens] [composed|fallback]
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const N = parseInt(process.argv[2] || '4', 10);
const MODE = process.argv[3] || 'composed'; // composed | fallback
const USERS = ['Arenovisk', 'Penguin_ZDNT', 'OldSmokeGuest', 'Penguin_63GM', 'RenamedPenguin', 'Penguin_GS6K'];

const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const pages = [];
for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1039, height: 551 } });
    const pg = await ctx.newPage();
    pages.push(pg);
    await pg.goto(`http://localhost:3000/?room=dance&penguin=${USERS[i % USERS.length]}`, { waitUntil: 'domcontentloaded' });
}
await pages[0].waitForTimeout(22000);
for (const [i, pg] of pages.entries()) {
    try {
        const st = await pg.evaluate(() => {
            const g = window.__game || window.game;
            const scene = Object.values(g.scene.keys).find((s) => s.localPlayer && s.remotePlayers);
            return scene ? { ok: true, remote: scene.remotePlayers.size, hasView: !!scene.localPlayer?.view } : { ok: false };
        });
        console.log('page', i, 'scene:', JSON.stringify(st));
    } catch (e) { console.log('page', i, 'scene err', e.message); }
}
// dispara dance em todos
for (const pg of pages) {
    await pg.evaluate(() => {
        const g = window.__game || window.game;
        const scene = Object.values(g.scene.keys).find((s) => s.localPlayer?.playEmote);
        scene?.handleAction?.('dance');
    }).catch(() => {});
}
await pages[0].waitForTimeout(2500);
// instrumento render() na pagina 0 (mede views locais+remotas)
await pages[0].evaluate(async (mode) => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.localPlayer && s.remotePlayers);
    window.__perf = { samples: [], views: 0 };
    if (mode === 'fallback') {
        const lib = await scene.penguinLibrary;
        lib.composedDraw = async () => false;
    }
    const proto = scene?.localPlayer?.view ? Object.getPrototypeOf(scene.localPlayer.view) : null;
    if (proto && !proto.__perfWrapped) {
        proto.__perfWrapped = true;
        const r0 = proto.render;
        proto.render = async function (...a) {
            const t = performance.now();
            try { return await r0.apply(this, a); }
            finally { window.__perf.samples.push(performance.now() - t); }
        };
    }
    setInterval(() => {
        window.__perf.views = [scene.localPlayer, ...scene.remotePlayers.values()].filter((p) => p?.view).length;
    }, 1000);
}, MODE);
await pages[0].waitForTimeout(12000);
await pages[0].screenshot({ path: 'tools/shots/dance-perf-'+MODE+'.png' });
const res = await pages[0].evaluate(() => {
    const s = window.__perf.samples.slice().sort((a, b) => a - b);
    const q = (p) => s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1) : null;
    return { n: s.length, views: window.__perf.views, p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: s.length ? +s[s.length - 1].toFixed(1) : null };
});
console.log('MODE=' + MODE, 'pages=' + N, JSON.stringify(res));
await browser.close();
process.exit(0);
