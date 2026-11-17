import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 160)));
await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.evaluate(() => window.__penguin.scene.changeRoom('shop', 500, 280));
await p.waitForFunction(() => { const s = window.__penguin.scene; return s.currentRoom === 'shop' && s._movieReady === true; }, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
await p.waitForFunction(() => (window.__penguin.scene.catalogue?._pageCache?.size || 0) > 0, null, { timeout: 120000 });

const stats = await p.evaluate(() => {
  const m = window.__penguin.scene.catalogue.movie;
  const main = m.data?.main;
  const per = {};
  const analyze = (entries, depth, acc) => {
    for (const e of entries || []) {
      const sid = String(e.id);
      const sp = m.sprites?.[sid];
      if (sp) {
        acc.sprites++;
        acc.spriteFrames += (sp.frames || []).length;
        for (const fr of sp.frames || []) analyze(fr, depth + 1, acc);
        continue;
      }
      const ch = m.characters?.[sid];
      if (ch?.file) { acc.shapes++; acc.files.add(ch.file); }
      if (ch?.kind) acc.kinds[ch.kind] = (acc.kinds[ch.kind] || 0) + 1;
    }
  };
  for (let f = 1; f <= (main?.frames?.length || 0); f++) {
    const acc = { sprites: 0, spriteFrames: 0, shapes: 0, files: new Set(), kinds: {} };
    analyze(main.frames[f - 1], 0, acc);
    per[f] = { sprites: acc.sprites, spriteFrames: acc.spriteFrames, shapes: acc.shapes, files: acc.files.size, kinds: acc.kinds };
  }
  // playheads: quantos sprites animados existem e seus comprimentos
  const ph = [...(m._playheadAll?.values?.() || [])];
  return { pages: per, playheads: ph.length, tlCount: Object.keys(m.sprites || {}).length, chars: Object.keys(m.characters || {}).length };
});
for (const [f, s] of Object.entries(stats.pages))
  console.log(`p${f}: sprites=${s.sprites} frames=${s.spriteFrames} shapes=${s.shapes} files=${s.files} kinds=${JSON.stringify(s.kinds)}`);
console.log('playheads', stats.playheads, 'timelines', stats.tlCount, 'chars', stats.chars);
await b.close();
