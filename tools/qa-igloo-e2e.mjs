// QA E2E do editor de igloo: trena -> editor -> selector -> gridview ->
// catalogos -> drag -> save. Screenshot em cada etapa.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'shots');
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const URL = 'http://localhost:3000/?room=igloo';

const browser = await chromium.launch({
    executablePath: EXE, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 180)); });

const scene = `(() => {
    const g = window.__game || window.game;
    return Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo');
})()`;
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => {
    const c = await ev(() => {
        const r = document.querySelector('canvas').getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    await page.screenshot({ path: path.join(SHOTS, name + '.png'), clip: c });
    console.log('shot', name);
};
const waitEditor = () => page.waitForFunction(`(() => {
    const s = ${scene};
    return !!s?.igloo?.editor?._saveBtn;
})()`, null, { timeout: 25000 });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);
await shot('e2e-01-room');

// ---- 1. clica na trena (edit_btn) ----
await ev(`(() => { const s = ${scene}; s.igloo._roomBtns?.forEach(b => b.emit?.('pointerup')); })()`);
// edit_btn eh o 2o roomBtn? melhor: clicar via coordenada real do botao
const editPos = await ev(`(() => {
    const s = ${scene};
    const b = s.igloo._roomBtns?.find(i => i._as2Tex) || s.igloo._roomBtns?.[1];
    if (!b) return null;
    const p = b.getBounds();
    return { x: (p.left + p.right) / 2, y: (p.top + p.bottom) / 2 };
})()`);
console.log('edit btn pos:', JSON.stringify(editPos));
// clica de verdade no canvas na posicao do botao
if (editPos) {
    const c = await ev(() => {
        const r = document.querySelector('canvas').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    // mundo->tela: canvas 872px p/ 760 mundo
    const sx = c.x + (editPos.x / 760) * c.w;
    const sy = c.y + (editPos.y / 480) * c.h;
    await page.mouse.click(sx, sy);
}
await waitEditor();
await page.waitForTimeout(600);
await shot('e2e-02-editor-open');

// estado do editor
const ed = await ev(`(() => {
    const s = ${scene}; const e = s.igloo.editor;
    return { open: e?.isOpen, ctrls: e?._ctrls?.length, items: e?.placement?.length,
             cover: !!e?._cover, save: !!e?._saveBtn, sel: !!e?._selector };
})()`);
console.log('editor:', JSON.stringify(ed));

// ---- 2. abre selector (caixa/View Items) ----
await ev(`(() => { const s = ${scene}; s.igloo.editor._toggleSelector(true); })()`);
await page.waitForTimeout(500);
await shot('e2e-03-selector');
const sel = await ev(`(() => {
    const s = ${scene}; const e = s.igloo.editor;
    return { vis: e?._selector?.visible, zones: e?._selectorZones?.filter(z=>z.visible).length };
})()`);
console.log('selector:', JSON.stringify(sel));

// ---- 3. clica aba "room" do selector -> gridview ----
await ev(`(() => {
    const s = ${scene}; const e = s.igloo.editor;
    e._toggleSelector(false);
    e._openGridview(1); // sort room
})()`);
await page.waitForTimeout(2500);
await shot('e2e-04-gridview');
const gv = await ev(`(() => {
    const s = ${scene}; const gv = s.igloo.editor._gridview;
    return gv ? { items: gv.items?.length ?? gv._items?.length, open: true } : { open: false };
})()`);
console.log('gridview:', JSON.stringify(gv));
await ev(`(() => { const s = ${scene}; s.igloo.editor._gridview?.destroy?.(); s.igloo.editor._gridview = null; })()`);

// ---- 4. catalogo furn2008 ----
await ev(`(() => { const s = ${scene}; s.catalogue.open('furn2008'); })()`);
await page.waitForTimeout(4000);
await shot('e2e-05-catalog-furn');
const cat1 = await ev(`(() => {
    const s = ${scene}; const c = s.catalogue;
    return { open: c.isOpen, key: c.key, controls: c.controls?.length };
})()`);
console.log('catalog furn:', JSON.stringify(cat1));
await ev(`(() => { const s = ${scene}; s.catalogue.close(); })()`);

// ---- 5. catalogo igloocat2008 ----
await ev(`(() => { const s = ${scene}; s.catalogue.open('igloocat2008'); })()`);
await page.waitForTimeout(4000);
await shot('e2e-06-catalog-igloo');
const cat2 = await ev(`(() => {
    const s = ${scene}; const c = s.catalogue;
    return { open: c.isOpen, key: c.key, controls: c.controls?.length };
})()`);
console.log('catalog igloo:', JSON.stringify(cat2));
await ev(`(() => { const s = ${scene}; s.catalogue.close(); })()`);

// ---- 6. drag de mobília (se houver) ----
const drag = await ev(`(() => {
    const s = ${scene}; const e = s.igloo.editor;
    if (!e._objs?.length) return 'no items';
    return 'has ' + e._objs.length + ' objs';
})()`);
console.log('drag prep:', drag);

// ---- 7. save ----
await ev(`(() => { const s = ${scene}; s.igloo.editor._save(); })()`);
await page.waitForTimeout(2500);
await shot('e2e-07-after-save');
const after = await ev(`(() => {
    const s = ${scene};
    return { editorOpen: !!s.igloo.editor?.isOpen, roomBtns: s.igloo._roomBtns?.length };
})()`);
console.log('after save:', JSON.stringify(after));

await browser.close();
console.log('DONE');