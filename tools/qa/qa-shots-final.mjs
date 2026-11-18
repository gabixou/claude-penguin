import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// clone: dance club com pinguins dançando
const ctx = await b.newContext({ viewport: { width: 1039, height: 551 } });
const pg = await ctx.newPage();
await pg.goto('http://localhost:3000/?room=dance&penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(25000);
await pg.evaluate(() => {
    const g = window.__game || window.game;
    const scene = Object.values(g.scene.keys).find((s) => s.localPlayer?.playEmote);
    scene?.handleAction?.('dance');
});
await pg.waitForTimeout(5000);
await pg.screenshot({ path: 'tools/shots/qa-clone-dance.png' });
// clone: town (sala normal, sem dance)
await pg.goto('http://localhost:3000/?room=town&penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(20000);
await pg.screenshot({ path: 'tools/shots/qa-clone-town.png' });
// referencia gopenguin
const pg2 = await (await b.newContext({ viewport: { width: 1039, height: 551 } })).newPage();
await pg2.goto('https://gopenguin.lol/?room=dance', { waitUntil: 'domcontentloaded' });
await pg2.waitForTimeout(15000);
await pg2.screenshot({ path: 'tools/shots/qa-ref-dance.png' });
await pg2.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await pg2.waitForTimeout(10000);
await pg2.screenshot({ path: 'tools/shots/qa-ref-town.png' });
await b.close();
process.exit(0);
