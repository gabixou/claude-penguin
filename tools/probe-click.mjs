import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=lodge', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const info = await p.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0];
    const inter = scene._interactions;
    const mv = scene.movie;
    const out = [];
    for (const btn of inter.buttons) {
        if (!btn.path.includes('game_btn')) continue;
        const [x0, y0, x1, y1] = btn.bounds;
        const dest = inter.clickTarget((x0 + x1) / 2, (y0 + y1) / 2);
        out.push({ path: btn.path, dest, trigger: dest ? (mv.triggerAt(dest.x, dest.y)?.table || null) : null });
    }
    return out;
});
console.log(JSON.stringify(info, null, 1));
await b.close();
