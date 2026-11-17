// QA E2E parte 2: seed inventario no sqlite, coloca mobília via gridview,
// arrasta, salva, recarrega, verifica persistencia.
import { chromium } from 'playwright-core';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'shots');
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const URL = 'http://localhost:3000/?room=igloo';
const DB = path.join(__dirname, '..', 'server', 'data', 'penguin.db');

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

// playerId + seed de inventario (mobília 1 = Pink Chair, qty 3)
const pid = await ev(`(() => { const s = ${scene}; return s.network?.playerId; })()`);
console.log('playerId:', pid);
{
    const db = new DatabaseSync(DB);
    db.prepare(`INSERT INTO igloo_inventory (player_id, kind, item_id, quantity) VALUES (?,?,?,?)
        ON CONFLICT(player_id, kind, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`)
        .run(pid, 'furniture', 1, 3);
    db.prepare(`INSERT INTO igloo_inventory (player_id, kind, item_id, quantity) VALUES (?,?,?,?)
        ON CONFLICT(player_id, kind, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`)
        .run(pid, 'furniture', 53, 2); // Snow Clump
    db.close();
    console.log('seeded inventory');
}

// abre editor (sendIglooInventory carrega o inventario seedado)
await ev(`(() => { const s = ${scene}; s.igloo.toggleEditor(); })()`);
await page.waitForFunction(`(() => { const s = ${scene}; return !!s?.igloo?.editor?._saveBtn; })()`, null, { timeout: 25000 });
await page.waitForTimeout(1500); // IGLOO_INVENTORY roundtrip

const inv = await ev(`(() => { const s = ${scene}; return s.igloo?.inventory; })()`);
console.log('inventory:', JSON.stringify(inv));

// gridview room sort -> pega item com count>0
const placed = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    await e._openGridview(1);
    await new Promise(r => setTimeout(r, 400));
    const gv = e._gridview;
    const items = gv?._items || gv?.items || [];
    const pick = items.find(i => (i.count || 0) > 0 && !i.disabled);
    if (!pick) return { err: 'no owned', owned: items.filter(i=>i.count>0).map(i=>i.id) };
    if (gv.onPick) gv.onPick(pick.id); else gv._onPick?.(pick.id);
    await new Promise(r => setTimeout(r, 1200));
    return { picked: pick.id, objs: e._objs?.length,
             placement: e.placement?.map(p=>({id:p.itemId,x:Math.round(p.x),y:Math.round(p.y)})) };
})()`);
console.log('placed:', JSON.stringify(placed));
await shot('e2e2-01-placed');

// ---- drag real: pointerdown na img + pointermove/up na scene.input ----
const drag = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    const img = e._objs?.[e._objs.length - 1];
    if (!img) return 'no img';
    const b = img.getBounds();
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    img.emit('pointerdown', { worldX: cx, worldY: cy, x: cx, y: cy });
    if (!e._drag) return 'drag not engaged';
    // move p/ posicao legal (centro da room_area ~ 380,330) e solta
    s.input.emit('pointermove', { worldX: 420, worldY: 340 });
    s.input.emit('pointerup', { worldX: 420, worldY: 340 });
    await new Promise(r => setTimeout(r, 300));
    const it = e.placement[e.placement.length - 1];
    return { moved: true, last: { id: it?.itemId, x: Math.round(it?.x), y: Math.round(it?.y) } };
})()`);
console.log('drag:', JSON.stringify(drag));

// save
await ev(`(() => { const s = ${scene}; s.igloo.editor._save(); })()`);
await page.waitForTimeout(2500);
await shot('e2e2-02-saved');
const after = await ev(`(() => { const s = ${scene}; return { open: !!s.igloo.editor?.isOpen, items: s.igloo.layout?.items?.length }; })()`);
console.log('after:', JSON.stringify(after));

// reload -> persistencia
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const persist = await ev(`(() => { const s = ${scene}; return s.igloo?.layout?.items || []; })()`);
console.log('persist:', JSON.stringify(persist).slice(0, 400));
await shot('e2e2-03-reloaded');

await browser.close();
console.log('DONE');