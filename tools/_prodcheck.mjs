import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1039, height: 551 } });
await p.goto('https://claudepenguin.mooo.com/?room=dance', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(20000);
const state = await p.evaluate(() => {
    const g = window.__game || window.game;
    const scene = g && Object.values(g.scene.keys).find((s) => s.localPlayer || s.penguins);
    return { hasGame: !!g, scene: scene?.scene?.key || null };
});
console.log(JSON.stringify(state));
await p.screenshot({ path: 'shots/prod-dance.png' });
await b.close();
process.exit(0);
