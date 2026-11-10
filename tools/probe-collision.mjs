import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'town';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
// espera movie + collision
let st = null;
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(2000);
  st = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    const m = s && s.movie;
    return m ? { movie: true, block: !!m._block, ntrig: (m._triggers || []).length,
      exits: m.exits, busy: (s.movieLayers || []).filter(l => l._busy).length } : { movie: false };
  }).catch(() => null);
  if (st && st.movie && st.block && st.busy === 0) break;
}
console.log('state:', JSON.stringify(st));
// testa hitBlock em varios pontos + findPath
const r = await p.evaluate(() => {
  const s = window.__penguin.scene, m = s.movie;
  const pts = [[380, 300], [100, 100], [700, 400], [30, 30], [380, 30], [760, 240], [20, 430]];
  const hits = pts.map(([x, y]) => ({ x, y, blocked: m.hitBlock(x, y) }));
  const paths = [
    m.findPath(380, 300, 700, 300),
    m.findPath(380, 300, 50, 50),
    m.findPath(380, 300, 700, 450),
  ];
  const trig = (m._triggers || []).map(t => ({ name: t.name, room: t.room, x: t.x, y: t.y }));
  return { hits, paths, trig, exits: m.exits };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
