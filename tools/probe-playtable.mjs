import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'lodge';
const game = process.argv[3] || 'four';
const tableId = Number(process.argv[4] || 205);
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(30000);
const info = await p.evaluate(async ({ g, id }) => {
    const scene = window.__game.scene.getScenes(true)[0];
    // dispara TABLE_JOIN como openTable faz
    scene.openTable({ game: g, id });
    await new Promise((r) => setTimeout(r, 3000));
    const tg = scene.tableGames;
    return {
        isOpen: tg?.isOpen,
        st: tg?.st ? { key: tg.st.key, game: tg.st.game, status: tg.st.status, you: tg.st.you } : null,
        err: document.querySelector('.cp-tg .err')?.textContent || null,
        title: document.querySelector('.cp-tg .top h2')?.textContent || null,
    };
}, { g: game, id: tableId });
console.log(JSON.stringify(info, null, 1));
console.log('ERRORS:', errs.length ? errs.slice(0, 8).join(' | ') : 'none');
await b.screenshot({ path: 'shots/table-' + room + '-' + game + '.png' });
await b.close();
