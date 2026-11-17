import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true || window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(2500);

// abre o painel social via API da cena
const opened = await p.evaluate(() => {
    const s = window.__penguin.scene;
    if (!s?.socialPanel) return 'NO_PANEL';
    s.socialPanel.open();
    return 'ok';
});
console.log('open:', opened);
await p.waitForTimeout(1200);

const state = await p.evaluate(() => {
    const panel = document.querySelector('.cp-social');
    const rows = panel?.querySelectorAll('.cp-social-row').length || 0;
    const secs = [...(panel?.querySelectorAll('.cp-social-sec') || [])].map((e) => e.textContent);
    const social = window.__penguin.scene.network?.social;
    return {
        visible: panel && !panel.classList.contains('hidden'),
        rows, secs,
        buddies: social?.buddies?.length, pets: social?.pets?.length,
        species: social?.petSpecies?.length,
    };
});
console.log('buddies tab:', JSON.stringify(state));

// aba pets
await p.evaluate(() => {
    [...document.querySelectorAll('.cp-social-tab')].find((t) => t.dataset.tab === 'pets')?.click();
});
await p.waitForTimeout(400);
const pets = await p.evaluate(() => ({
    rows: document.querySelectorAll('.cp-social-body .cp-social-row').length,
    secs: [...document.querySelectorAll('.cp-social-sec')].map((e) => e.textContent),
}));
console.log('pets tab:', JSON.stringify(pets));

// aba ignorados
await p.evaluate(() => {
    [...document.querySelectorAll('.cp-social-tab')].find((t) => t.dataset.tab === 'ignored')?.click();
});
await p.waitForTimeout(300);
const ign = await p.evaluate(() => document.querySelector('.cp-social-empty')?.textContent || 'rows:' + document.querySelectorAll('.cp-social-row').length);
console.log('ignored tab:', ign);

await p.screenshot({ path: 'tools/shots/social-panel.png' });
console.log('screenshot: tools/shots/social-panel.png');
await b.close();
