import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000/?room=dance', { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(15000);
const state = await p.evaluate(() => {
    const g = window.__game || window.game;
    const scene = g && Object.values(g.scene.keys).find((s) => s.localPlayer || s.penguins);
    const ps = scene?.penguins;
    return {
        hasGame: !!g,
        scene: scene?.scene?.key || null,
        penguinCount: ps ? (ps instanceof Map ? ps.size : (ps.size ?? ps.length ?? Object.keys(ps).length)) : null,
    };
});
console.log(JSON.stringify(state));
await b.close();
process.exit(0);
