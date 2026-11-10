import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.waitForTimeout(2000);
const info = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  // zonas do HUD vetorial
  const hudZones = [];
  sc.gpHud?.list?.forEach(o => { if (o.type === 'Zone') { const b = o.getBounds(); hudZones.push({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }); } });
  // trigger clothing_mc: bounds do grid
  const trig = (sc.movie?._triggers || []).find(t => t.name === 'clothing_mc');
  let trigBox = null;
  if (trig?.grid) {
    const g = trig.grid; let x0=1e9,y0=1e9,x1=-1,y1=-1;
    for (let y=0;y<g.h;y++) for (let x=0;x<g.w;x++) if (g.data[y*g.w+x]) { const wx=x/g.w*760, wy=y/g.h*480; if(wx<x0)x0=wx; if(wx>x1)x1=wx; if(wy<y0)y0=wy; if(wy>y1)y1=wy; }
    trigBox = { x0:Math.round(x0), y0:Math.round(y0), x1:Math.round(x1), y1:Math.round(y1) };
  }
  // testa triggerAt no centro do trigger
  const hit = trigBox ? sc.movie.triggerAt((trigBox.x0+trigBox.x1)/2, (trigBox.y0+trigBox.y1)/2) : null;
  return { hudZones, trigBox, hit, blockY: sc.gpHud?.blockY };
});
console.log(JSON.stringify(info, null, 1));
// clique real no clothing_btn (centro ~702,436 -> coords de tela)
const rect = await p.evaluate(() => { const r = window.__penguin.scene.game.canvas.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const sx = rect.l + (702/760)*rect.w, sy = rect.t + (436/480)*rect.h;
console.log('clique em', sx, sy);
await p.mouse.click(sx, sy);
await p.waitForTimeout(2500);
const after = await p.evaluate(() => ({ catOpen: !!window.__penguin.scene.catalogue?.isOpen, catKey: window.__penguin.scene.catalogue?.key, player: window.__penguin.scene.localPlayer ? {x:Math.round(window.__penguin.scene.localPlayer.x),y:Math.round(window.__penguin.scene.localPlayer.y)} : null }));
console.log('apos clique:', JSON.stringify(after));
await b.close();
