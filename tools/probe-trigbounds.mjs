import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'lodge';
const want = process.argv[3] || '205';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const info = await p.evaluate((wantId) => {
    const scene = window.__game.scene.getScenes(true)[0];
    const mv = scene.movie;
    const pts = [];
    let minX = 999, maxX = -1, minY = 999, maxY = -1;
    for (let y = 20; y <= 430; y += 4) {
        for (let x = 20; x <= 740; x += 4) {
            const t = mv.triggerAt(x, y);
            const id = t?.table?.id ?? t?.room ?? t?.game;
            if (String(id) === wantId || (t?.table && String(t.table.id) === wantId)) {
                pts.push([x, y]);
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
    }
    // centroide + ponto mais alcancavel (perto do walk do botao)
    const cx = Math.round((minX + maxX) / 2), cy = Math.round((minY + maxY) / 2);
    return { count: pts.length, bounds: [minX, minY, maxX, maxY], center: [cx, cy], centerTrigger: mv.triggerAt(cx, cy)?.table || null };
}, want);
console.log(JSON.stringify(info));
await b.close();
