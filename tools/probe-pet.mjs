import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => { window.__penguin.scene.changeRoom('pet'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'pet', null, { timeout: 240000 });
await p.waitForFunction(() => { const c = window.__penguin.scene.cameras.main; return c.scrollX === c._lastSX && c.scrollY === c._lastSY ? true : (c._lastSX = c.scrollX, c._lastSY = c.scrollY, false); }, null, { timeout: 15000 }).catch(()=>{});
await new Promise(r => setTimeout(r, 300));

const info = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const trg = (s.movie._triggers || []).filter(t => t.game || t.content || t.room).map(t => ({ n: t.name, game: t.game, room: t.room, c: t.content }));
  const btns = (s._interactions?.buttons || []).filter(b => /roundup|door|exit/i.test(b.path + (b.name||''))).map(b => ({ p: b.path, n: b.name, b: b.bounds, g: b.game, c: b.content, w: b.walk }));
  return { trg, btns };
});
console.log('TRIGGERS:', JSON.stringify(info.trg));
console.log('BTNS:', JSON.stringify(info.btns));

// pega o botao roundup e clica no centro dele (coords de tela)
const click = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const b = (s._interactions?.buttons || []).find(b => /roundup/i.test(b.path + (b.name||'')));
  if (!b) return null;
  const cam = s.cameras.main, m = cam.matrix, c = s.game.canvas;
  const [x0,y0,x1,y1] = b.bounds;
  const wx = b.walk ? b.walk[0] : (x0+x1)/2, wy = b.walk ? b.walk[1] : (y0+y1)/2;
  const px = m.a*wx + m.c*wy + m.tx;
  const py = m.b*wx + m.d*wy + m.ty;
  const rect = c.getBoundingClientRect();
  const k = rect.width / c.width;
  return { sx: rect.left + px*k, sy: rect.top + py*k, wx, wy, path: b.path };
});
console.log('CLICK:', JSON.stringify(click));
if (click) {
  await p.mouse.click(click.sx, click.sy);
  await p.waitForTimeout(4000); // anda ate a porta + trigger
  const st = await p.evaluate(() => {
    const s = window.__penguin.scene;
    const fr = document.querySelector('iframe[src*="pufflescape"]');
    return { iframe: !!fr, pos: [s.localPlayer?.x, s.localPlayer?.y], room: s.currentRoom, overlay: !!document.querySelector('div[style*="z-index: 10000"]') };
  });
  console.log('AFTER CLICK:', JSON.stringify(st));
  await p.screenshot({ path: 'shots/pet-puffle.png' });
  // fecha overlay
  await p.evaluate(() => { document.querySelector('iframe[src*="pufflescape"]')?.parentElement?.parentElement?.querySelector('div[title]')?.click(); });
  await p.waitForTimeout(500);
  const st2 = await p.evaluate(() => ({ iframe: !!document.querySelector('iframe[src*="pufflescape"]') }));
  console.log('AFTER CLOSE:', JSON.stringify(st2));
}
console.log('ERRS:', JSON.stringify(errs.slice(0,5)));
await b.close();
