import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer, null, { timeout: 120000 });
await p.waitForTimeout(3500);
const st = await p.evaluate(async () => {
  const w = window.__penguin.scene.buddyWindow;
  if (!w._ready) await new Promise(r => setTimeout(r, 3000));
  const r = w.rows[0];
  return {
    nameBounds: r?.children.name_txt,
    iconBounds: r?.children.icon_mc,
    btnBounds: r?.children.item_btn,
    textXY: [w.rowTexts[0]?.x, w.rowTexts[0]?.y, w.rowTexts[0]?.originX, w.rowTexts[0]?.originY],
  };
});
console.log(JSON.stringify(st));
await b.close();
