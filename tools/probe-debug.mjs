import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=lodge', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const info = await p.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0];
    const mv = scene.movie;
    const btn = scene._interactions?.buttons?.find((x) => x.path === 'table205_mc.game_btn');
    return {
        hasTriggerCenter: typeof mv.triggerCenter,
        center: mv.triggerCenter?.('table205_mc'),
        btnWalk: btn?.walk,
        btnBounds: btn?.bounds,
        trigNames: (mv._triggers || []).map((t) => t.name),
    };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
