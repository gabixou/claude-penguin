import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 200)); });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(18000);
// abre o catalogo furn2008 via overlay
const r = await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue || s.catalogOverlay || s._catalogue;
    if (!cat) return { err: 'no catalogue', keys: Object.keys(s).filter(k=>/cat/i.test(k)) };
    cat.open('furn2008_catalogue');
    await new Promise(r2 => setTimeout(r2, 6000));
    return { open: cat.isOpen, page: cat.page, movie: !!cat.movie };
})()`);
console.log('open:', JSON.stringify(r));
// vai pra pagina 4
await page.evaluate(`(async () => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue || s.catalogOverlay || s._catalogue;
    cat.movie.goto('book', 4);
    await cat._show();
})()`);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'tools/shots/furn-p4-hidden.png' });
// estado do sprite secret
const st = await page.evaluate(`(() => {
    const g = window.__game || window.game;
    const s = Object.values(g.scene.keys).find((x) => x.catalogue);
    const cat = s.catalogue || s.catalogOverlay || s._catalogue;
    const m = cat.movie;
    const h = m._playheads.get('book.secret');
    return { secretFrame: h?.frame, stopped: h?.stopped, sid: h?.sid, controls: cat.controls.length,
             secretCtrls: cat.controls.filter(c=>/secret|213/.test(c.path)).map(c=>({p:c.path,b:c.bounds,l:c.label})) };
})()`);
console.log('state p4:', JSON.stringify(st));
// clica no trigger (button 213) — centro dos bounds
if (st.secretCtrls?.length) {
    const b = st.secretCtrls[0].b;
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    console.log('clicking trigger at', cx, cy);
    await page.evaluate(`(async () => {
        const g = window.__game || window.game;
        const s = Object.values(g.scene.keys).find((x) => x.catalogue);
        const cat = s.catalogue || s.catalogOverlay || s._catalogue;
        cat.clickAt(${cx}, ${cy});
        await new Promise(r => setTimeout(r, 800));
    })()`);
    await page.waitForTimeout(800);
    const st2 = await page.evaluate(`(() => {
        const g = window.__game || window.game;
        const s = Object.values(g.scene.keys).find((x) => x.catalogue);
        const cat = s.catalogue || s.catalogOverlay || s._catalogue;
        const h = cat.movie._playheads.get('book.secret');
        return { secretFrame: h?.frame, stopped: h?.stopped };
    })()`);
    console.log('apos click:', JSON.stringify(st2));
    await page.screenshot({ path: 'tools/shots/furn-p4-revealed.png' });
    // espera uns segundos e tira mais screenshots p/ ver flicker
    for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `tools/shots/furn-p4-flick${i}.png` });
    }
}
await browser.close();
