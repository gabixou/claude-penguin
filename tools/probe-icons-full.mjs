import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForFunction(() => window.__penguin.scene.wardrobe?.isOpen, null, { timeout: 30000 });
const res = await p.evaluate(async () => {
  const w = window.__penguin.scene.wardrobe;
  const sc = window.__penguin.scene;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (const t of w.cats) {
    if (t === 'color') continue;
    const items = w.items.filter(it => (t === 'all' || it.slot === t) && w.ownedIds?.has(it.id) && it.name);
    const pages = Math.ceil(items.length / 12);
    for (let pg = 0; pg < pages; pg++) { w.tab = t; w.page = pg; await w._renderGrid(); await sleep(300); }
  }
  await sleep(10000);
  const failed = [...w._iconTex.entries()].filter(([k, v]) => v === null).map(([k]) => k);
  const blank = [];
  for (const [id, key] of w._iconTex) {
    if (!key) continue;
    const img = sc.textures.get(key).getSourceImage();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 20) opaque++;
    if (opaque < 10) blank.push(id);
  }
  return { total: w._iconTex.size, failed, blank };
});
console.log(JSON.stringify(res));
await b.close();
