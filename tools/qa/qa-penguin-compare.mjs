import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const MODE = process.argv[2] || 'composed';
const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 1039, height: 551 } })).newPage();
await pg.goto('http://localhost:3000/?room=dance&penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(25000);
if (MODE === 'fallback') {
    await pg.evaluate(async () => {
        const g = window.__game || window.game;
        const scene = Object.values(g.scene.keys).find((s) => s.localPlayer);
        const lib = await scene.penguinLibrary;
        lib.composedDraw = async () => false;
    });
}
await pg.evaluate(() => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.localPlayer?.playEmote);
    scene?.handleAction?.('dance');
});
await pg.waitForTimeout(6000);
await pg.screenshot({ path: 'tools/shots/penguin-' + MODE + '.png' });
await b.close();
process.exit(0);
