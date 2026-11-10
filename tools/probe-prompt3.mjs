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
await click(380, 240); await p.waitForTimeout(800);
// escolhe item NAO possuido
const buy = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const c = sc.catalogue.controls.find(c => c._buyKind === 'items' && !sc.network.hasItem(c._itemId));
  return c ? { bounds: c.bounds.map(v=>Math.round(v)), label: c.label, id: c._itemId } : null;
});
console.log('buy:', JSON.stringify(buy));
const coins0 = await p.evaluate(() => window.__penguin.scene.network.coins);
await click((buy.bounds[0]+buy.bounds[2])/2, (buy.bounds[1]+buy.bounds[3])/2);
await p.waitForTimeout(1500);
let st = await p.evaluate(() => ({ open: !!window.__penguin.scene.catalogue?._prompt?.isOpen, frame: window.__penguin.scene.catalogue?._prompt?.movie?.currentFrame('interface_mc.prompt_mc') }));
console.log('confirm:', JSON.stringify(st), '(frame2=yes/no)');
await p.screenshot({ path: 'shots/prompt-confirm.png' });
// Yes
await click(325, 219);
await p.waitForTimeout(1500);
st = await p.evaluate(() => ({ promptOpen: !!window.__penguin.scene.catalogue?._prompt?.isOpen, coins: window.__penguin.scene.network.coins, inv: window.__penguin.scene.network.inventory.length }));
console.log('apos Yes:', JSON.stringify(st), 'coins0=', coins0);
await p.screenshot({ path: 'shots/prompt-done.png' });
// fecha o notice de done (se houver) e testa moedas insuficientes
await p.evaluate(() => { const pr = window.__penguin.scene.catalogue._prompt; if (pr?.isOpen) { const b = pr.movie.boundsFor('interface_mc.prompt_mc.ok_btn'); pr.cont.list.filter(o=>o.type==='Zone').pop().emit('pointerdown'); } });
await p.waitForTimeout(400);
await p.evaluate(() => { window.__penguin.scene.network.coins = 0; });
await click((buy.bounds[0]+buy.bounds[2])/2, (buy.bounds[1]+buy.bounds[3])/2);
await p.waitForTimeout(1500);
st = await p.evaluate(() => ({ open: !!window.__penguin.scene.catalogue?._prompt?.isOpen, frame: window.__penguin.scene.catalogue?._prompt?.movie?.currentFrame('interface_mc.prompt_mc') }));
console.log('low coin:', JSON.stringify(st), '(frame4=ok notice)');
await p.screenshot({ path: 'shots/prompt-lowcoin.png' });
await b.close();
