// Probe do catalogo no clone: abre clothing, lista controles por pagina,
// vira paginas, testa compra.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.changeRoom('shop', 500, 280));
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.currentRoom === 'shop' && sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(3000);
const dump = async (tag) => {
    const r = await p.evaluate(() => {
        const c = window.__penguin.scene.catalogue;
        return { page: c.page, controls: c.controls.length, labels: c.controls.map(x => x.label).slice(0, 25) };
    });
    console.log(tag, JSON.stringify(r));
    return r;
};
await dump('p1');
await p.screenshot({ path: 'tools/shots/cat2-p1.png' });
// proxima pagina via controle Next page
for (let i = 2; i <= 4; i++) {
    const rr = await p.evaluate(async () => {
        const c = window.__penguin.scene.catalogue;
        const next = c.controls.find(x => x.label === 'Next page');
        if (next) next.action();
        await new Promise(r => setTimeout(r, 2500));
        return { page: c.page, controls: c.controls.length };
    });
    console.log('->', JSON.stringify(rr));
    await p.screenshot({ path: `tools/shots/cat2-p${i}.png` });
}
// pagina 3 = tshirt customizer
await p.evaluate(() => window.__penguin.scene.catalogue.movie.goto('book', 3));
await p.waitForTimeout(500);
await p.evaluate(() => window.__penguin.scene.catalogue._buildControls());
await p.waitForTimeout(1500);
await dump('tshirt');
await p.screenshot({ path: 'tools/shots/cat2-tshirt.png' });
// compra: primeiro controle Buy
const buy = await p.evaluate(async () => {
    const s = window.__penguin.scene;
    const c = s.catalogue;
    c.movie.goto('book', 2); // pagina com itens
    await new Promise(r => setTimeout(r, 300));
    c._buildControls();
    const b = c.controls.find(x => /^Buy /.test(x.label));
    if (!b) return { err: 'no buy', labels: c.controls.map(x => x.label).slice(0, 20) };
    b.action();
    await new Promise(r => setTimeout(r, 800));
    return { clicked: b.label, dialog: !!c._dialog, coins: s.network?.coins };
});
console.log('buy:', JSON.stringify(buy));
await p.screenshot({ path: 'tools/shots/cat2-buy.png' });
const yes = await p.evaluate(async () => {
    const s = window.__penguin.scene;
    const c = s.catalogue;
    if (!c._dialog) return { dialog: false };
    let clicked = false;
    for (const k of c._dialog.list) {
        if (k.type === 'Container' && k.list?.some(t => t.text === 'Yes')) { k.emit('pointerdown'); clicked = true; break; }
    }
    await new Promise(r => setTimeout(r, 3000));
    return { clicked, dialog: !!c._dialog, coins: s.network?.coins, inv: s.network?.inventory?.length };
});
console.log('yes:', JSON.stringify(yes));
await p.screenshot({ path: 'tools/shots/cat2-bought.png' });
console.log('errors:', errors.slice(0, 5));
await b.close();
