import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(3000);
const dump = async (tag) => {
    const r = await p.evaluate(() => {
        const c = window.__penguin.scene.catalogue;
        return { page: c.page, controls: c.controls.length, labels: c.controls.map(x => x.label).slice(0, 20) };
    });
    console.log(tag, JSON.stringify(r));
    return r;
};
await dump('p1');
await p.screenshot({ path: 'tools/shots/cat3-p1.png' });
// next page real
await p.evaluate(async () => {
    const c = window.__penguin.scene.catalogue;
    const n = c.controls.find(x => x.label === 'Next page');
    if (n) n.action();
    await new Promise(r => setTimeout(r, 2500));
});
await dump('p2');
await p.screenshot({ path: 'tools/shots/cat3-p2.png' });
// achar item NAO possuido para comprar
const buy = await p.evaluate(async () => {
    const s = window.__penguin.scene;
    const c = s.catalogue;
    const owned = new Set((s.network?.inventory || []).map(i => i.itemId));
    // varrer paginas atras de um Buy de item nao possuido
    for (let pg = 1; pg <= 12; pg++) {
        c.movie.goto('book', pg);
        await new Promise(r => setTimeout(r, 350));
        c._buildControls();
        const b = c.controls.find(x => x._itemId && !owned.has(x._itemId));
        if (b) { b.action(); await new Promise(r => setTimeout(r, 900)); return { page: pg, label: b.label, dialog: !!c._dialog, coins: s.network?.coins }; }
    }
    return { err: 'no unowned buy found' };
});
console.log('buy:', JSON.stringify(buy));
await p.screenshot({ path: 'tools/shots/cat3-buy.png' });
const yes = await p.evaluate(async () => {
    const s = window.__penguin.scene;
    const c = s.catalogue;
    const clickYes = () => {
        for (const k of c._dialog?.list || []) {
            if (k.type === 'Container' && k.list?.some(t => t.text === 'Yes')) { k.emit('pointerdown'); return true; }
        }
        return false;
    };
    const c1 = clickYes();
    await new Promise(r => setTimeout(r, 3500));
    return { clicked: c1, dialog: !!c._dialog, coins: s.network?.coins, inv: s.network?.inventory?.length,
        dlgText: c._dialog ? c._dialog.list.find(o => o.type === 'Text')?.text : null };
});
console.log('yes:', JSON.stringify(yes));
await p.screenshot({ path: 'tools/shots/cat3-bought.png' });
console.log('errors:', errors.slice(0, 5));
await b.close();
