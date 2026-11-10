import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const out = { user: scene.network.username };
  scene.wardrobe?.open(scene.localPlayer);
  await new Promise(r => setTimeout(r, 3500));
  const w = scene.wardrobe;
  const countTab = async (t) => {
    w.tab = t; w.page = 0; w._renderGrid();
    await new Promise(r => setTimeout(r, 700));
    return w.cells?.length ?? -1;
  };
  out.counts = {};
  for (const t of ['flag', 'photo', 'all']) out.counts[t] = await countTab(t);
  // clica na primeira celula da aba flag e depois photo (toggle equip)
  const clickFirst = async (t) => {
    w.tab = t; w.page = 0; w._renderGrid();
    await new Promise(r => setTimeout(r, 700));
    const cell = w.cells?.[0];
    if (!cell) return null;
    // a zone eh o ultimo filho interativo
    const zone = cell.list.find(o => o.input);
    zone?.emit('pointerdown', { x: 0, y: 0 });
    await new Promise(r => setTimeout(r, 900));
    return { ...scene.localPlayer.gpaOutfit };
  };
  out.afterFlagClick = await clickFirst('flag');
  out.afterPhotoClick = await clickFirst('photo');
  out.netEquipped = { ...scene.network.equipped };
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('pageerrors:', errs.length ? errs.slice(0, 3) : 'zero');
await b.close();
