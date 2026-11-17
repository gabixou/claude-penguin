import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => window.__penguin.scene.catalogue?.isOpen, null, { timeout: 60000 });
const st = await p.evaluate(() => {
  const m = window.__penguin.scene.catalogue.movie;
  const { entries, handlers } = m.collectInteractive();
  const dump = (path) => {
    const node = m._nodes.get(m._normalizePath(path));
    if (!node) return null;
    const e = node.entry, sid = String(e.id);
    const isSp = !!m.sprites[sid], ch = m.characters[sid];
    const h = isSp && m._playhead(m._normalizePath(path), sid);
    return {
      path, id: e.id, name: e.name, sprite: isSp, kind: ch?.kind, file: ch?.file,
      matrix: e.matrix, frame: h?.frame,
      subEntries: isSp ? (h?.tl.frames[h.frame-1]||[]).map(x=>({id:x.id,name:x.name,matrix:x.matrix,depth:x.depth})) : null,
    };
  };
  return {
    handlers: handlers.map(h => ({ path: h.path, body: h.body.slice(0,120), base: h.base })),
    n54: dump('#54'), n736: dump('#736'),
    totalEntries: entries.length,
    // entries com bounds dentro do stage
    onscreen: entries.filter(e => e.bounds && e.bounds[0] < 760 && e.bounds[1] < 480 && e.bounds[2] > 0 && e.bounds[3] > 0).map(e => ({path:e.path,name:e.name,bounds:e.bounds.map(v=>Math.round(v)),acts:e.acts})),
  };
});
console.log(JSON.stringify(st, null, 1).slice(0, 8000));
await b.close();
