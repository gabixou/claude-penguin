// QA E2E parte 3: teclado no drag (setas/Delete), wall item, lock toggle,
// aba igloo (troca de tipo), music window.
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
const pid = await ev(`(() => { const s = ${scene}; return s.network?.playerId; })()`);
{ const db = new DatabaseSync(DB);
  // mobília room (1) + wall (67 = Mermaid Clock type 2)
  for (const [id, q] of [[1, 3], [67, 2]])
    db.prepare(`INSERT INTO igloo_inventory (player_id, kind, item_id, quantity) VALUES (?,?,?,?)
      ON CONFLICT(player_id, kind, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`).run(pid, 'furniture', id, q);
  db.close(); }

await ev(`(() => { const s = ${scene}; s.igloo.toggleEditor(); })()`);
await page.waitForFunction(`(() => { const s = ${scene}; return !!s?.igloo?.editor?._saveBtn; })()`, null, { timeout: 25000 });
await page.waitForTimeout(1200);

// coloca room item (1) e wall item (67) via placement direto + render
const placed = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    e.placement.push({ itemId: 1, x: 380, y: 380, type: 1, rotation: 1, frame: 1 });
    e.placement.push({ itemId: 67, x: 380, y: 160, type: 2, rotation: 2, frame: 1 });
    s.igloo._renderFurniture(e.placement, { lift: 45 });
    return e.placement.length;
})()`);
console.log('placed:', placed);
await page.waitForFunction(`(() => {
    const s = ${scene}; return (s.igloo._furnSprites?.size || 0) >= 2;
})()`, null, { timeout: 20000 }).catch(() => console.log('sprites timeout'));
const imgs = await ev(`(() => {
    const s = ${scene};
    return [...(s.igloo._furnSprites?.values()||[])].map(i => ({ id: i._iglooItem?.itemId, x: Math.round(i.x), y: Math.round(i.y) }));
})()`);
console.log('imgs:', JSON.stringify(imgs));
await shot('e2e5-01-two-items');

// ---- teclado: setas rodam frame_1, Delete remove ----
const keys = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    const img = [...(s.igloo._furnSprites?.values()||[])].find(i => i._iglooItem?.itemId === 1);
    if (!img) return 'no room img';
    const b = img.getBounds();
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    img.emit('pointerdown', { worldX: cx, worldY: cy, x: cx, y: cy });
    await new Promise(r => setTimeout(r, 150));
    const rot0 = e.placement.find(p => p.itemId === 1)?.rotation;
    // ArrowRight -> frame_1 +1
    e._dragKey({ code: 'ArrowRight', preventDefault(){} });
    await new Promise(r => setTimeout(r, 300));
    const rot1 = e.placement.find(p => p.itemId === 1)?.rotation;
    // solta
    s.input.emit('pointerup', { worldX: cx, worldY: cy });
    return { rot0, rot1, dragEngaged: !!e._drag };
})()`);
console.log('keys:', JSON.stringify(keys));

// wall item: setas NAO devem rodar (type 2)
const wallKey = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    const img = [...(s.igloo._furnSprites?.values()||[])].find(i => i._iglooItem?.itemId === 67);
    if (!img) return 'no wall img';
    const b = img.getBounds();
    const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    img.emit('pointerdown', { worldX: cx, worldY: cy, x: cx, y: cy });
    await new Promise(r => setTimeout(r, 150));
    const r0 = e.placement.find(p => p.itemId === 67)?.rotation;
    e._dragKey({ code: 'ArrowRight', preventDefault(){} });
    await new Promise(r => setTimeout(r, 200));
    const r1 = e.placement.find(p => p.itemId === 67)?.rotation;
    s.input.emit('pointerup', { worldX: cx, worldY: cy });
    return { wallRot0: r0, wallRot1: r1 };
})()`);
console.log('wall keys:', JSON.stringify(wallKey));

// ---- lock toggle ----
const lock = await ev(`(async () => {
    const s = ${scene};
    const before = { friendsOnly: s.igloo.layout?.friendsOnly, hasPw: s.igloo.layout?.hasPassword };
    // clica no lock btn (roomBtns[0])
    const b = s.igloo._roomBtns?.[0];
    if (b) b.emit('pointerup');
    await new Promise(r => setTimeout(r, 300));
    // confirm() nativo? nosso _lockToggle usa confirm — auto-aceita via dialog handler? testa estado
    return { before, after: { friendsOnly: s.igloo.layout?.friendsOnly } };
})()`);
console.log('lock:', JSON.stringify(lock));

// ---- music window ----
const music = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    e._openMusic?.();
    await new Promise(r => setTimeout(r, 600));
    return { win: !!e._musicWin, el: e._musicWin?.tagName || e._musicWin?.constructor?.name };
})()`);
console.log('music:', JSON.stringify(music));
await shot('e2e5-02-music');

// ---- aba igloo (gridview de tipos) ----
const iglooTab = await ev(`(async () => {
    const s = ${scene}; const e = s.igloo.editor;
    await e._openIglooGrid();
    await new Promise(r => setTimeout(r, 800));
    const gv = e._gridview;
    return { open: !!gv, items: gv?.items?.length, iglooItems: gv?.items?.filter(i=>i.igloo)?.length };
})()`);
console.log('igloo tab:', JSON.stringify(iglooTab));
await shot('e2e5-03-igloogrid');

// ---- save ----
await ev(`(() => { const s = ${scene}; s.igloo.editor._save(); })()`);
await page.waitForTimeout(2500);
await shot('e2e5-04-saved');
const after = await ev(`(() => { const s = ${scene}; return { open: !!s.igloo.editor?.isOpen, items: s.igloo.layout?.items }; })()`);
console.log('after:', JSON.stringify(after));
await browser.close();
console.log('DONE');