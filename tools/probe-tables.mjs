import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'lodge';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const info = await p.evaluate(() => {
    const g = window.__game;
    const scene = g?.scene.getScenes(true)[0];
    const mv = scene?.movie;
    const inter = scene?._interactions;
    return {
        room: scene?.currentRoom,
        triggers: (mv?._triggers || []).map((t) => ({ name: t.name, table: t.table, game: t.game, content: t.content, room: t.room })),
        trigTableParsed: mv?.interactions?.trigTable,
        hintsParsed: mv?.interactions?.hint,
        buttons: (inter?.buttons || []).map((b) => ({ path: b.path, hint: b.hint, walk: b.walk, disabled: b.disabled })),
    };
});
console.log(JSON.stringify(info, null, 1).slice(0, 5000));
console.log('ERRORS:', errs.length ? errs.slice(0, 8).join(' | ') : 'none');
await b.close();
