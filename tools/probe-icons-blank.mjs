import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.wardrobe.open(window.__penguin.scene.localPlayer));
await p.waitForTimeout(12000);
const res = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const w = sc.wardrobe;
  const blank = [], ok = [];
  for (const [id, key] of w._iconTex) {
    if (!key) continue;
    const img = sc.textures.get(key).getSourceImage();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, c.width, c.height).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 20) opaque++;
    (opaque < 10 ? blank : ok).push(id);
  }
  return { ok: ok.length, blank };
});
console.log(JSON.stringify(res));
await b.close();
