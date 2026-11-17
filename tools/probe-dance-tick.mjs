import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=dance', { waitUntil: 'domcontentloaded' });
try {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true && window.__penguin.scene.currentRoom === 'dance', null, { timeout: 90000 });
} catch { console.log('room:', await p.evaluate(() => window.__penguin?.scene?.currentRoom)); }
await p.waitForTimeout(1000);
// amostra _dirtyPaths por 2s e estado dos playheads "missed"
const res = await p.evaluate(async () => {
  const s = window.__penguin.scene, m = s.movie;
  const missedPaths = [
    'background_mc.disco01dotsstates_mc.disco01dots_mc',
    'background_mc.dancefloor_mc#1',
    'background_mc.danceposter_mc.danceposterlang_mc',
    'background_mc.disco02states_mc.disco02rotate_mc',
    'height_mc.disco01states_mc.disco01_mc',
    'height_mc.stagelights_mc#1',
    'disco03states_mc.disco03mech_mc',
    'speakerfront02all_mc#6#4',
    'foreground_mc.disco02states_mc.disco02_mc',
  ];
  const ph = {};
  for (const mp of missedPaths) {
    let h = m._playheads.get(mp);
    if (!h) for (const [k, v] of m._playheads) if (k === mp || k.endsWith('.' + mp)) { h = v; break; }
    ph[mp] = h ? { frame: h.frame, stopped: h.stopped, tl: h.tl === m._mainTl ? 'main' : Object.keys(m.sprites).find(k => m.sprites[k] === h.tl) } : null;
  }
  const dirtySamples = [];
  for (let i = 0; i < 48; i++) {
    await new Promise(r => setTimeout(r, 40));
    dirtySamples.push([...(m._dirtyPaths || [])]);
  }
  const uniq = new Set(dirtySamples.flat());
  return { ph, uniqDirty: [...uniq].slice(0, 60), nDirtySamples: dirtySamples.filter(d => d.length).length };
});
console.log('playheads missed:');
for (const [k, v] of Object.entries(res.ph)) console.log(' ', k, '=>', JSON.stringify(v));
console.log('dirty paths únicos em 2s:', res.uniqDirty.length, 'amostras não-vazias:', res.nDirtySamples);
for (const d of res.uniqDirty) console.log('  dirty:', d);
await b.close();
