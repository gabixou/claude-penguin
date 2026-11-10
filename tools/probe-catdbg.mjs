import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
const r = await p.evaluate(async () => {
    const s = window.__penguin.scene;
    const { MovieRoom } = await import('/src/movie/movie.js').catch(() => ({}));
    return 'need module';
});
// MovieRoom nao e global; usar o catalogo aberto
await p.evaluate(() => window.__penguin.scene.catalogue?.open('clothing'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(2500);
const dbg = await p.evaluate(() => {
    const c = window.__penguin.scene.catalogue;
    const m = c.movie;
    const { entries, handlers } = m.collectInteractive();
    return {
        page: m.currentFrame('book'),
        entries: entries.map(e => ({ path: e.path, id: e.id, name: e.name, bounds: e.bounds?.map(v=>Math.round(v)), hasRel: !!e.acts?.release, hasRoll: !!e.acts?.rollOver })),
        handlers: handlers.slice(0, 10),
        nHandlers: handlers.length,
        controls: c.controls.map(x => x.label),
    };
});
console.log(JSON.stringify(dbg, null, 1).slice(0, 6000));
await b.close();
