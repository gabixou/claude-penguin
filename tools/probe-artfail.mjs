import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') console.log('CONS', m.text().slice(0, 300)); });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view?._warmDone === true, null, { timeout: 60000 });

const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const v = scene.localPlayer.view;
  const lib = await scene.penguinLibrary;
  const out = {};
  // pega o movie clothing/374 (um dos que falha)
  let m374 = null;
  for (const it of v.items.values()) {
    if (it.m && (it.m.base || '').includes('374')) m374 = it.m;
  }
  if (!m374) return { err: 'no 374' };
  out.base = m374.base;
  out.cacheBefore = m374._artCache.size;
  // chama artCanvas direto com um file qualquer do pack
  const files = Object.keys(m374.characters || {}).slice(0, 3).map(id => m374.characters[id].file).filter(Boolean);
  out.files = files;
  for (const f of files.slice(0, 1)) {
    const ch = Object.values(m374.characters).find(c => c.file === f);
    const key = f + '|10.630';
    out.keyExistsBefore = m374._artCache.has(key);
    try {
      const res = await m374.artCanvas(f, ch, 10.63);
      out.result = res ? `${res.width}x${res.height}` : 'null';
    } catch (e) { out.err = String(e).slice(0, 300); }
    out.keyExistsAfter = m374._artCache.has(key);
    out.cacheAfter = m374._artCache.size;
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
