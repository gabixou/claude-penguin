import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=town', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
// abre catalogo de roupas direto
await p.evaluate(() => window.__penguin.scene.catalogue?.open?.('clothing'));
await p.waitForTimeout(6000);
const st = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue;
  return c?.movie ? { open: true, page: c.page, canvas: [c.canvas?.width, c.canvas?.height], ss: c._renderSs } : { open: false };
});
console.log('catalogue:', JSON.stringify(st));
await p.screenshot({ path: 'tools/shots/cat-clothing-p1.png' });
// pagina 2
await p.evaluate(() => { const c = window.__penguin.scene.catalogue; c?.movie?.nextFrame?.('book'); });
await p.waitForTimeout(2500);
await p.screenshot({ path: 'tools/shots/cat-clothing-p2.png' });
await b.close();
