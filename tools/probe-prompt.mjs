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
const click = async (wx, wy) => { await p.mouse.click(rect.l + (wx/760)*rect.w, rect.t + (wy/480)*rect.h); await p.waitForTimeout(900); };
// vai pra pagina 2 e clica no primeiro item de compra
await click(380, 240);
await p.waitForTimeout(800);
const buy = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue.controls.find(c => c._buyKind === 'items');
  return c ? { bounds: c.bounds.map(v=>Math.round(v)), label: c.label } : null;
});
console.log('buy ctrl:', JSON.stringify(buy));
await click((buy.bounds[0]+buy.bounds[2])/2, (buy.bounds[1]+buy.bounds[3])/2);
await p.waitForTimeout(1500);
const prompt = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  return { open: !!sc.catalogue?._prompt?.isOpen, promptFrame: sc.catalogue?._prompt?.movie?.currentFrame('interface_mc.prompt_mc') };
});
console.log('prompt apos buy:', JSON.stringify(prompt));
await p.screenshot({ path: 'shots/prompt-buy.png' });
// clica Yes
const yes = await p.evaluate(() => {
  const m = window.__penguin.scene.catalogue._prompt.movie;
  const b = m.boundsFor('interface_mc.prompt_mc.yes_btn');
  return b ? { x:(b[0]+b[2])/2, y:(b[1]+b[3])/2 } : null;
});
console.log('yes bounds:', JSON.stringify(yes));
if (yes) await click(yes.x, yes.y);
await p.waitForTimeout(800);
const after = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  return { promptOpen: !!sc.catalogue?._prompt?.isOpen, coins: sc.network?.coins, inv: sc.network?.inventory?.length };
});
console.log('apos Yes:', JSON.stringify(after));
// testa moedas insuficientes: zera coins e tenta comprar de novo
await p.evaluate(() => { window.__penguin.scene.network.coins = 0; });
await p.waitForTimeout(300);
await click((buy.bounds[0]+buy.bounds[2])/2, (buy.bounds[1]+buy.bounds[3])/2);
await p.waitForTimeout(1500);
const low = await p.evaluate(() => ({ open: !!window.__penguin.scene.catalogue?._prompt?.isOpen, frame: window.__penguin.scene.catalogue?._prompt?.movie?.currentFrame('interface_mc.prompt_mc') }));
console.log('prompt insuficiente:', JSON.stringify(low));
await p.screenshot({ path: 'shots/prompt-lowcoin.png' });
await b.close();
