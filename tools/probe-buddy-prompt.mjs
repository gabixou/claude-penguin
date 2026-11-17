import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(2000);

// simula pedido de buddy -> prompt_mc yes/no
await p.evaluate(() => {
    window.__penguin.scene.events.emit('buddy-request', { fromUsername: 'ProbeBeta', fromPlayerId: 'p_test123' });
});
await p.waitForTimeout(2500);
const st = await p.evaluate(() => {
    const s = window.__penguin.scene;
    return {
        promptOpen: !!s.promptUI?.isOpen,
        contChildren: s.promptUI?.cont?.list?.length,
    };
});
console.log('prompt state:', JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/buddy-prompt.png' });

// clica no botao yes (zona inferior direita do prompt) — tenta achar zona
const clicked = await p.evaluate(() => {
    const s = window.__penguin.scene;
    const zones = s.promptUI?.cont?.list?.filter(o => o.type === 'Zone') || [];
    return zones.length;
});
console.log('zones:', clicked);
await b.close();
console.log('done');
