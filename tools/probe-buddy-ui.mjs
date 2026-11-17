import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(2500);

const opened = await p.evaluate(() => {
    const s = window.__penguin.scene;
    if (!s?.buddyPanel) return 'NO_PANEL';
    s.buddyPanel.open();
    return 'ok';
});
console.log('open:', opened);
await p.waitForTimeout(1000);

for (const tab of ['buddies', 'room', 'blocked']) {
    await p.evaluate((t) => {
        [...document.querySelectorAll('.cp-buddy-tab')].find((x) => x.dataset.tab === t)?.click();
    }, tab);
    await p.waitForTimeout(400);
    const st = await p.evaluate(() => ({
        tab: document.querySelector('.cp-buddy-tab.on')?.dataset.tab,
        rows: document.querySelectorAll('.cp-buddy-row').length,
        secs: [...document.querySelectorAll('.cp-buddy-sec')].map((e) => e.textContent),
        empty: document.querySelector('.cp-buddy-empty')?.textContent || null,
        btns: [...document.querySelectorAll('.cp-buddy-row .cp-buddy-btn')].map((x) => x.textContent),
    }));
    console.log(tab, JSON.stringify(st));
}
await p.screenshot({ path: 'tools/shots/buddy-panel.png' });
console.log('shot saved');
await b.close();
