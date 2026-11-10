import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
let ok = false;
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(2000);
  ok = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    const m = s && s.movie;
    return !!(m && m._block && !(s.movieLayers || []).some(l => l._busy));
  }).catch(() => false);
  if (ok) break;
}
console.log('collision ready:', ok);
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene, m = s.movie, pg = window.__penguin;
  const trig = (m._triggers || []).find(t => t.name === 'dock_mc');
  if (!trig) return { err: 'no dock trigger' };
  // acha um pixel setado no grid do trigger -> coords de mundo
  const g = trig.grid, sc = m._colScale;
  let wx = -1, wy = -1;
  outer: for (let y = 0; y < g.h; y += 2) for (let x = 0; x < g.w; x += 2) {
    if (g.data[y * g.w + x]) { wx = x / sc; wy = y / sc; break outer; }
  }
  // centro do bounding box do trigger seria melhor; pega um ponto qualquer setado
  return await new Promise((res) => {
    pg.setPosition(wx - 30, wy);
    pg.moveTo(wx, wy, 500, () => {
      const exit = m.triggerAt(pg.x, pg.y);
      res({ trigXY: [wx, wy], px: pg.x, py: pg.y, exit, room: s.currentRoom });
    });
    setTimeout(() => res({ timeout: true, px: pg.x, py: pg.y, room: s.currentRoom }), 15000);
  });
});
console.log('walk result:', JSON.stringify(r));
if (r.exit) {
  await p.evaluate((ex) => { window.__penguin.scene.changeRoom(ex.room, ex.x, ex.y); }, r.exit);
  await p.waitForTimeout(5000);
  const st = await p.evaluate(() => {
    const s = window.__penguin.scene;
    return { room: s.currentRoom, movie: !!s.movie, px: window.__penguin.x, py: window.__penguin.y };
  });
  console.log('after changeRoom:', JSON.stringify(st));
}
await b.close();
