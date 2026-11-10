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
  // conta celulas por aba (procurando zones _item)
  const countTab = async (t) => {
    w.tab = t; w.page = 0; w._renderGrid();
    await new Promise(r => setTimeout(r, 600));
    return (w._gridCont?.list || []).filter(c => c._zone || c.itemId).length;
  };
  out.counts = {};
  for (const t of ['flag', 'photo', 'all']) out.counts[t] = await countTab(t);
  // screenshot do wardrobe na aba photo
  w.tab = 'photo'; w.page = 0; w._renderGrid();
  await new Promise(r => setTimeout(r, 1200));
  return out;
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'tools/shots/wardrobe-photo.png' });
// abre player card para ver fundo+pin
await p.evaluate(() => { window.__penguin.scene.playerCard?.open(window.__penguin.scene.localPlayer); });
await p.waitForTimeout(3000);
await p.screenshot({ path: 'tools/shots/card-pin-bg.png' });
const card = await p.evaluate(() => {
  const lp = window.__penguin.scene.localPlayer;
  return { outfit: lp.gpaOutfit };
});
console.log('outfit:', JSON.stringify(card.outfit));
console.log('pageerrors:', errs.length ? errs.slice(0, 3) : 'zero');
await b.close();
