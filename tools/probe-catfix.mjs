import { chromium } from 'playwright-core';
const cat = process.argv[2] || 'clothing';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate((c) => window.__penguin.scene.openContent(c + '_catalogue'), cat);
await p.waitForTimeout(4000);
// paginas (1-based) que tem o sprite 'secret' com ids diferentes
const r = await p.evaluate(async () => {
  const m = window.__penguin.scene.catalogue.movie;
  const out = [];
  for (const f of [4, 5, 6, 9, 12, 13, 14, 15, 16, 17]) {
    m.goto('book', f);
    await m.renderFrame(undefined, document.createElement('canvas'), 1).catch(() => {});
    const h = m._playheads.get('secret');
    // qual sprite id esta na entrada 'secret' deste frame?
    const frame = m._mainTl.frames[f - 1] || [];
    const e = frame.find((x) => x.name === 'secret');
    const tlId = h ? Object.keys(m.sprites).find((k) => m.sprites[k] === h.tl) : null;
    out.push({ page: f, entryId: e?.id, playheadSprite: tlId, match: String(e?.id) === tlId });
  }
  return out;
});
for (const o of r) console.log(`page ${o.page}: entry sprite ${o.entryId} -> playhead ${o.playheadSprite} ${o.match ? 'OK' : 'VAZOU'}`);
console.log('pageerrors:', errs.length ? errs : 'zero');
await b.close();
