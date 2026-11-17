import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'lodge';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const info = await p.evaluate(() => {
    const scene = window.__game.scene.getScenes(true)[0];
    const mv = scene.movie;
    const inter = scene._interactions;
    const out = { room: scene.currentRoom, checks: [] };
    for (const btn of inter?.buttons || []) {
        if (!btn.path.includes('game_btn') && !btn.path.includes('waddle')) continue;
        const [x, y] = btn.walk || [0, 0];
        const t = mv.triggerAt(x, y);
        const blocked = mv.hitBlock(x, y);
        // scan: menor distancia até sair do trigger a partir do walk
        let exit = null;
        for (let r = 10; r <= 120 && !exit; r += 10) {
            for (let a = 0; a < 16; a++) {
                const ex = x + Math.round(r * Math.cos(a * Math.PI / 8));
                const ey = y + Math.round(r * Math.sin(a * Math.PI / 8));
                if (!mv.triggerAt(ex, ey) && !mv.hitBlock(ex, ey) && ex > 20 && ex < 740 && ey > 20 && ey < 430) { exit = [ex, ey]; break; }
            }
        }
        out.checks.push({ path: btn.path, walk: [x, y], trigger: t ? (t.table || t.game || t.content || t.room) : null, blocked, exit });
    }
    return out;
});
console.log(JSON.stringify(info, null, 1));
await b.close();
