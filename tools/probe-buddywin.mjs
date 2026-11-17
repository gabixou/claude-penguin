import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
p.on('console', (m) => { if (/buddy|error/i.test(m.text())) console.log('CON:', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(3000); // espera _init async (movie load)

const st = await p.evaluate(async () => {
    const s = window.__penguin.scene;
    const w = s.buddyWindow;
    if (!w) return 'NO_WINDOW';
    if (!w._ready) { await new Promise(r => setTimeout(r, 3000)); }
    w.open();
    await new Promise(r => setTimeout(r, 800));
    // mede pixels nao-transparentes do canvas da janela
    const c = w.canvas;
    const cx = c.getContext('2d');
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let i = 3; i < d.length; i += 400) if (d[i] > 10) painted++;
    return {
        ready: w._ready, open: w.open_, tab: w.tab,
        bounds: w.winBounds, painted,
        title: w.titleText?.text, total: w.totalText?.text,
        texts: w.rowTexts?.map(t => t?.text).filter(Boolean),
        zones: w.container?.list?.length,
    };
});
console.log('state:', JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/buddy-window.png' });
// troca pra aba room
await p.evaluate(() => window.__penguin.scene.buddyWindow._setTab('room'));
await p.waitForTimeout(800);
const st2 = await p.evaluate(() => ({
    tab: window.__penguin.scene.buddyWindow.tab,
    title: window.__penguin.scene.buddyWindow.titleText?.text,
    texts: window.__penguin.scene.buddyWindow.rowTexts?.map(t => t?.text).filter(Boolean),
}));
console.log('room tab:', JSON.stringify(st2));
await p.screenshot({ path: 'tools/shots/buddy-window-room.png' });
await b.close();
console.log('done');
