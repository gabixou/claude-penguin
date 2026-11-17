import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('CON', m.text().slice(0, 200)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const dyns = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const m = s.movie;
  return (s._dynList || []).map((d, i) => ({
    i, path: d.path, sid: d.sid,
    hasCanvas: !!d.canvas, w: d.canvas?.width, h: d.canvas?.height,
    hasImg: !!d.img, visible: d.img?.visible,
    frames: m.sprites[d.sid]?.frames?.length,
    bounds: d.canvas ? [d.ox, d.oy] : null,
  }));
});
console.log('dynCount:', dyns.length);
for (const d of dyns) console.log(JSON.stringify(d));
// tambem: sprites animados que existiam mas NAO viraram overlay?
const missed = await p.evaluate(() => {
  const s = window.__penguin.scene, m = s.movie;
  const skipped = m._skipDynamic || new Set();
  const found = [];
  const walk = (entries, path) => {
    for (const e of entries || []) {
      const cp = m._path(path, e);
      const sid = String(e.id);
      if (m.sprites[sid] && (m.sprites[sid].frames?.length || 1) > 1) {
        found.push({ path: cp, sid, overlay: skipped.has(cp) });
      }
      if (m.sprites[sid]) walk(m.sprites[sid].frames?.[0] || [], cp);
    }
  };
  for (const l of m.topLevelLayers()) walk([l.entry], '');
  return found;
});
console.log('animated sprites found:', missed.length);
for (const f of missed) console.log(' ', f.overlay ? 'OVL' : 'STATIC', f.path, 'sid', f.sid);
await b.close();
