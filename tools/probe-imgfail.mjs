import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const room = process.argv[2] || 'mine';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('CON', m.text().slice(0, 160)); });
await p.goto('http://localhost:3000/?room=' + room, { waitUntil: 'domcontentloaded' });
let ok = false;
for (let i = 0; i < 120; i++) {
  await p.waitForTimeout(2000);
  ok = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    return !!(s && s.movie && s.movieLayers && s.movieLayers.length);
  }).catch(() => false);
  if (ok) break;
}
await p.waitForTimeout(20000); // tempo dos renders
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const m = s.movie;
  const fails = [], pending = [];
  for (const [f, pr] of m._imgCache) {
    const img = await pr;
    if (!img) fails.push(f); else if (!img.naturalWidth) pending.push(f);
  }
  // arquivos referenciados mas nunca pedidos
  const wanted = new Set();
  const walk = (entries) => { for (const e of entries || []) {
    const sid = String(e.id);
    const sp = m.sprites[sid];
    if (sp) { const h = m._playhead('x' + sid, sid); if (h) walk(h.tl.frames[h.frame - 1]); }
    else { const ch = m.characters[sid]; if (ch && ch.file) wanted.add(ch.file); }
  }};
  return { total: m._imgCache.size, fails, pending };
});
console.log(room, JSON.stringify(r));
await b.close();
