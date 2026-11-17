import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1000);
const info = await p.evaluate(() => {
  const s = window.__penguin.scene, m = s.movie;
  const out = {};
  const d73 = (s._dynList || []).find(d => d.sid === '76');
  if (d73) {
    const h = m._playhead(d73.path, '76');
    out.d73 = {
      path: d73.path,
      hasPlayhead: !!h,
      framesLen: h?.tl?.frames?.length,
      frameEntries: h?.tl?.frames?.map(f => f.map(e => ({ n: e.name, id: e.id, d: e.depth }))),
      bounds: m.dynBounds(d73, s._ss),
    };
  }
  const sp125 = m.sprites['125'];
  out.sp125 = {
    frames: sp125?.frames?.length,
    frame0: sp125?.frames?.[0]?.map(e => {
      const sid = String(e.id);
      return { n: e.name, id: sid, sprite: !!m.sprites[sid], frames: m.sprites[sid]?.frames?.length, kind: m.characters[sid]?.kind, file: m.characters[sid]?.file };
    }),
  };
  const sp56 = m.sprites['56'];
  out.sp56 = {
    frames: sp56?.frames?.length,
    frame0names: sp56?.frames?.[0]?.map(e => ({ n: e.name, id: String(e.id), sprite: !!m.sprites[String(e.id)], kind: m.characters[String(e.id)]?.kind })),
  };
  // bounds por frame do #132 usando worldDev = ss * dyn.world
  const dyn132 = (s._dynList || []).find(d => d.sid === '125');
  const h132 = m._playhead('#132', '125');
  if (dyn132 && h132) {
    const w = dyn132.world, ss = s._ss;
    const worldDev = { a: ss * w.a, b: ss * w.b, c: ss * w.c, d: ss * w.d, x: ss * w.x, y: ss * w.y };
    const perFrame = [];
    for (let i = 0; i < h132.tl.frames.length; i++) {
      perFrame.push(m._boundsOfEntries(h132.tl.frames[i], worldDev, '#132'));
    }
    const valid = perFrame.filter(Boolean);
    out.f132 = {
      nFrames: perFrame.length,
      nullFrames: perFrame.length - valid.length,
      union: valid.length ? [
        Math.min(...valid.map(b => b[0])), Math.min(...valid.map(b => b[1])),
        Math.max(...valid.map(b => b[2])), Math.max(...valid.map(b => b[3]))
      ] : null,
      sample: perFrame.slice(0, 5),
    };
  }
  return out;
});
console.log(JSON.stringify(info, null, 1).slice(0, 8000));
await b.close();
