import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(600);
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const click = async (wx, wy) => { await p.mouse.click(rect.l + (wx/760)*rect.w, rect.t + (wy/480)*rect.h); await p.waitForTimeout(700); };
// clique no centro da capa (dentro do hit area Next page)
await click(380, 240);
let st = await p.evaluate(() => ({ page: window.__penguin.scene.catalogue.page, controls: window.__penguin.scene.catalogue.controls.length }));
console.log('apos clique capa:', JSON.stringify(st));
// pagina 2: conta botoes de compra
st = await p.evaluate(() => window.__penguin.scene.catalogue.controls.map(c => c.label).slice(0, 20));
console.log('labels p2:', JSON.stringify(st));
// volta pra capa? testa close: vai pra uma pagina com botao close — procura bounds do close na p2
const close = await p.evaluate(() => {
  const cs = window.__penguin.scene.catalogue.controls.filter(c => /close/i.test(c.label));
  return cs.map(c => ({ label: c.label, bounds: c.bounds.map(v=>Math.round(v)) }));
});
console.log('close controls:', JSON.stringify(close));
if (close[0]) { const b0 = close[0].bounds; await click((b0[0]+b0[2])/2, (b0[1]+b0[3])/2); }
await p.waitForTimeout(500);
st = await p.evaluate(() => ({ open: !!window.__penguin.scene.catalogue?.isOpen }));
console.log('apos close:', JSON.stringify(st));
await b.close();
