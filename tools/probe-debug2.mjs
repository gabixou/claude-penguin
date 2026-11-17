import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=lodge', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const info = await p.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0];
    const mv = scene.movie;
    const ci = mv.interactions;
    const clickKeys = Object.keys(ci.click || {}).filter((k) => k.includes('game_btn') || k.includes('table'));
    const btn = scene._interactions?.buttons?.find((x) => x.path === 'table205_mc.game_btn');
    return {
        clickKeys,
        click205: ci.click?.['table205_mc.game_btn'],
        matchPath: mv._matchPath(ci.click, 'table205_mc.game_btn', 'game_btn'),
        btnWalk: btn?.walk,
        scriptKeys: Object.keys((window.__rs || {})),
    };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
