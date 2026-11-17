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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g.model.fishCaught = 60;
  g.movie.goto('', 39, false);
  g._mullet();
  // fast-forward: posiciona playhead do 444 no frame 212 direto
  for (const h of g.movie._playheadAll.values()) {
    if (h.sid === '444') { h.frame = 212; h.stopped = true; }
    if (h.sid === '443') { h.frame = 1; h.stopped = true; }
  }
  await sleep(300);
  const { entries, nodes } = g.movie.collectInteractive();
  const all = entries.map(e => ({ path: e.path, id: e.id, name: e.name, acts: e.acts ? Object.keys(e.acts) : null, rel: e.acts?.release ? e.acts.release.replace(/\s+/g, ' ').slice(0, 50) : null, b: e.bounds?.map(v => Math.round(v)) }));
  // nodes sob 444
  const n444 = [...nodes.keys()].filter(k => k.includes('444'));
  // bounds do botao 440 manualmente
  const mv = g.movie;
  let manual = null;
  try {
    const node = nodes.get('444#443#440') || nodes.get('444.443.440');
    manual = { foundKeys: n444.slice(0, 20), nodeKey: node ? 'yes' : 'no' };
    if (node) manual.bounds = mv._entryBounds(node.entry, node.matrix, node.parent ?? '')?.map(v => Math.round(v));
  } catch (e) { manual = { err: String(e) }; }
  return { main: mv._mainFrame, nEntries: entries.length, all, manual };
});
console.log(JSON.stringify(res, null, 1));
await b.close();
