import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(500);
const res = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const mv = g.movie;
  g.model.fishCaught = 60;
  mv.goto('', 39, false);
  g._mullet();
  for (const h of mv._playheadAll.values()) {
    if (h.sid === '444') { h.frame = 212; h.stopped = true; }
    if (h.sid === '443') { h.frame = 1; h.stopped = true; }
  }
  await new Promise(r => setTimeout(r, 300));
  const { entries, nodes } = mv.collectInteractive();
  const keys = [...nodes.keys()];
  const under2 = keys.filter(k => k.startsWith('#2'));
  // entry 440 no frame 212 do 444: qual depth?
  const s444 = mv.sprites['444'];
  const fr212 = s444.frames[211];
  const e443 = fr212.find(e => e.id === 443);
  const s443 = mv.sprites['443'];
  const e440 = s443.frames[0].find(e => e.id === 440);
  // bounds manual do 440
  const path443 = '#2#' + e443.depth;
  const node443 = nodes.get(path443);
  const path440 = path443 + '#' + e440.depth;
  const node440 = nodes.get(path440);
  let b440 = null, err = null;
  try {
    if (node440) b440 = mv._entryBounds(node440.entry, node440.matrix, node440.parent ?? '')?.map(v => +v.toFixed(1));
    else if (node443) {
      // simula: bounds do 440 com matrix do pai
      const world = node443.matrix;
      b440 = mv._boundsOfEntries([e440], world, path443)?.map(v => +v.toFixed(1));
    }
  } catch (e2) { err = String(e2); }
  const ch440 = mv.characters?.['440'];
  return {
    e443depth: e443?.depth, path443, node443: !!node443,
    e440depth: e440?.depth, path440, node440: !!node440,
    under2: under2.slice(0, 30),
    b440, err,
    ch440kind: ch440?.kind, ch440keys: ch440 ? Object.keys(ch440) : null,
    entries440: entries.filter(e => e.id === 440).map(e => ({ path: e.path, b: e.bounds })),
    state443: mv.getState?.(path443), vis440: mv.getState?.(path440),
  };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
