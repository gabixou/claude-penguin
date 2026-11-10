import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForTimeout(5000);
const info = await p.evaluate(async () => {
  const pg = window.__penguin, v = pg.view;
  const out = { look: v.look, viewItems: [...v.items.keys()], libItems: v.lib.items.size, outfit: pg.gpaOutfit };
  // resolve manualmente os clips e veja se o then do setLook rodaria
  const c = await v.lib.itemClip(221);
  out.clip221 = c ? 'ok' : 'null';
  return out;
});
console.log(JSON.stringify(info));
await p.waitForTimeout(3000);
const after = await p.evaluate(() => [...window.__penguin.view.items.keys()]);
console.log('items after manual:', JSON.stringify(after));
await b.close();
