import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
p.on('console', m => { if (m.type() === 'warning') console.log('warn:', m.text().slice(0,160)); });
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
await p.waitForTimeout(600);
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const click = async (wx, wy) => { await p.mouse.click(rect.l + (wx/760)*rect.w, rect.t + (wy/480)*rect.h); await p.waitForTimeout(900); };
await click(380, 240); await p.waitForTimeout(800);
const buy = await p.evaluate(() => {
  const c = window.__penguin.scene.catalogue.controls.find(c => c._buyKind === 'items');
  return { bounds: c.bounds.map(v=>Math.round(v)), label: c.label, id: c._itemId };
});
console.log('buy:', JSON.stringify(buy));
await click((buy.bounds[0]+buy.bounds[2])/2, (buy.bounds[1]+buy.bounds[3])/2);
await p.waitForTimeout(1500);
// estado do prompt: zones e bounds
const pz = await p.evaluate(() => {
  const pr = window.__penguin.scene.catalogue._prompt;
  const zones = pr.cont.list.filter(o => o.type === 'Zone').map(z => { const b=z.getBounds(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; });
  return { open: pr.isOpen, zones, gen: pr._gen };
});
console.log('prompt zones:', JSON.stringify(pz));
// clica yes via evaluate no centro da zone
const yesZone = await p.evaluate(() => {
  const pr = window.__penguin.scene.catalogue._prompt;
  const zs = pr.cont.list.filter(o => o.type === 'Zone');
  return zs.map(z => { const b=z.getBounds(); return {x:(b.x+b.width/2), y:(b.y+b.height/2)}; });
});
console.log('zone centers:', JSON.stringify(yesZone));
await click(yesZone[1].x, yesZone[1].y); // zones[0]=swallow, [1]=primeira btn
await p.waitForTimeout(1200);
const st = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  return { promptOpen: !!sc.catalogue?._prompt?.isOpen, closedAt: sc._promptClosedAt, coins: sc.network?.coins, invLen: sc.network?.inventory?.length, invTail: sc.network?.inventory?.slice(-2) };
});
console.log('apos yes:', JSON.stringify(st));
await p.screenshot({ path: 'shots/prompt-after-yes.png' });
await b.close();
