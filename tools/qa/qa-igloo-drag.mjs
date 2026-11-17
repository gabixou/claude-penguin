// QA drag: pega a imagem real em mgr._furnSprites e arrasta.
import { chromium } from 'playwright-core';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, '..', 'shots');
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const URL = 'http://localhost:3000/?room=igloo';
const DB = path.join(__dirname, '..', '..', 'server', 'data', 'penguin.db');

const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 250)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.currentRoom === 'igloo'); })()`;
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => {
    const c = await ev(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.screenshot({ path: path.join(SHOTS, n + '.png'), clip: c });
    console.log('shot', n);
};

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(9000);

// seed inventario (guest novo a cada run)
const pid = await ev(`(() => { const s = ${scene}; return s.network?.playerId; })()`);
{
    const db = new DatabaseSync(DB);
    db.prepare(`INSERT INTO igloo_inventory (player_id, kind, item_id, quantity) VALUES (?,?,?,?)
        ON CONFLICT(player_id, kind, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`)
        .run(pid, 'furniture', 1, 3);
    db.close();
}

// abre editor
await ev(`(() => { const s = ${scene}; s.igloo.toggleEditor(); })()`);
await page.waitForFunction(`(() => { const s = ${scene}; return !!s?.igloo?.editor?._saveBtn; })()`, null, { timeout: 25000 });
await page.waitForTimeout(1500);

// coloca item via gridview se placement vazio
await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    if (e.placement?.length) return 'has items';
    await e._openGridview(1);
    await new Promise(r => setTimeout(r, 400));
    const items = e._gridview?._items || e._gridview?.items || [];
    const pick = items.find(i => (i.count || 0) > 0 && !i.disabled);
    if (pick) { e._gridview.onPick?.(pick.id); await new Promise(r => setTimeout(r, 1200)); }
    e._gridview?.destroy?.(); e._gridview = null;
    return pick?.id || 'none';
})()`);
await page.waitForTimeout(800);

const st = await ev(`(() => {
    const s = ${scene}; const e = s.igloo.editor;
    return { placement: e.placement?.length, sprites: s.igloo._furnSprites?.size,
             imgs: [...(s.igloo._furnSprites?.values()||[])].map(i=>({x:Math.round(i.x),y:Math.round(i.y),interactive:!!i.input}) ) };
})()`);
console.log('state:', JSON.stringify(st));

// drag na primeira imagem
const drag = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    const img = [...(s.igloo._furnSprites?.values()||[])][0];
    if (!img) return 'no img';
    const b = img.getBounds();
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    img.emit('pointerdown', { worldX: cx, worldY: cy, x: cx, y: cy });
    await new Promise(r => setTimeout(r, 100));
    const engaged = !!e._drag;
    // move p/ (450,350) e solta
    s.input.emit('pointermove', { worldX: 450, worldY: 350 });
    s.input.emit('pointerup', { worldX: 450, worldY: 350 });
    await new Promise(r => setTimeout(r, 400));
    const it = e.placement[0];
    return { engaged, after: { x: Math.round(it?.x), y: Math.round(it?.y) } };
})()`);
console.log('drag:', JSON.stringify(drag));
await shot('e2e3-01-dragged');

// teste lixeira: arrasta p/ fora da area (trash)
const trash = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    const img = [...(s.igloo._furnSprites?.values()||[])][0];
    if (!img) return 'no img';
    const b = img.getBounds();
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    img.emit('pointerdown', { worldX: cx, worldY: cy, x: cx, y: cy });
    await new Promise(r => setTimeout(r, 100));
    s.input.emit('pointermove', { worldX: 30, worldY: 30 }); // canto = trash
    s.input.emit('pointerup', { worldX: 30, worldY: 30 });
    await new Promise(r => setTimeout(r, 400));
    return { placement: e.placement?.length, sprites: s.igloo._furnSprites?.size };
})()`);
console.log('trash:', JSON.stringify(trash));

// recoloca se foi deletado (pra testar save)
if (trash.placement === 0) {
    await ev(`(async () => {
        const s = ${scene}; const e = s.igloo.editor;
        await e._openGridview(1);
        await new Promise(r => setTimeout(r, 300));
        const items = e._gridview?._items || e._gridview?.items || [];
        const pick = items.find(i => (i.count || 0) > 0 && !i.disabled);
        if (pick) { e._gridview.onPick?.(pick.id); await new Promise(r => setTimeout(r, 800)); }
        return pick?.id;
    })()`);
}

// save
await ev(`(() => { const s = ${scene}; s.igloo.editor._save(); })()`);
await page.waitForTimeout(2500);
await shot('e2e3-02-saved');
const after = await ev(`(() => { const s = ${scene}; return { open: !!s.igloo.editor?.isOpen, items: s.igloo.layout?.items }; })()`);
console.log('after:', JSON.stringify(after));
await browser.close();
console.log('DONE');