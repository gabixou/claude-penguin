import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const netErrs = [];
p.on('console', m => { if (m.text().includes('Net error') || m.text().includes('EQUIP')) netErrs.push(m.text()); });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const net = scene.network;
  const out = { username: net.username, coins: net.coins };
  // abre wardrobe e conta itens por aba
  scene.wardrobe?.open(scene.localPlayer);
  await new Promise(r => setTimeout(r, 3000));
  const w = scene.wardrobe;
  out.tabs = {};
  for (const t of w.cats) {
    w.tab = t; w.page = 0; w._renderGrid?.();
    await new Promise(r => setTimeout(r, 400));
    const cells = w._gridCont?.list || [];
    out.tabs[t] = cells.filter(c => c.itemId || c._item).length;
  }
  // equipa um pin (type8) e um fundo (type9) via _pickItem real
  const items = w.items || [];
  const pin = items.find(i => i.slot === 'flag');
  const bg = items.find(i => i.slot === 'photo');
  out.pin = pin; out.bg = bg;
  if (pin) { w.tab = 'flag'; w.page = 0; w._renderGrid(); await new Promise(r=>setTimeout(r,300));
    const cell = (w._gridCont?.list||[]).find(c => (c.itemId===pin.id || c._item?.id===pin.id));
    out.pinCell = !!cell;
    if (cell) cell.emit ? cell.emit('pointerdown') : cell._zone?.emit('pointerdown');
  }
  await new Promise(r=>setTimeout(r,800));
  out.equippedAfterPin = { ...scene.localPlayer.gpaOutfit };
  if (bg) { w.tab = 'photo'; w.page = 0; w._renderGrid(); await new Promise(r=>setTimeout(r,300));
    const cell = (w._gridCont?.list||[]).find(c => (c.itemId===bg.id || c._item?.id===bg.id));
    out.bgCell = !!cell;
    if (cell) cell._zone?.emit('pointerdown');
  }
  await new Promise(r=>setTimeout(r,800));
  out.equippedAfterBg = { ...scene.localPlayer.gpaOutfit };
  out.netEquipped = { ...net.equipped };
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('pageerrors:', errs.length ? errs.slice(0,3) : 'zero');
console.log('neterrs:', netErrs.slice(0,5));
await b.close();
