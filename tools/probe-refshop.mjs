import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
// tenta abrir o catalogo: clicar no botao de roupa (canto inferior direito)
const r = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  return c ? c.getBoundingClientRect() : null;
});
if (r) {
  await p.mouse.click(r.left + (702/760)*r.width, r.top + (436/480)*r.height);
  await p.waitForTimeout(4000);
}
await p.screenshot({ path: 'shots/ref-shop-cat.png' });
console.log('done');
await b.close();
