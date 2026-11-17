import { chromium } from 'playwright-core';
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
const res = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const m = g.movie;
  const out = { filesSize: m.files?.size, svgCacheSize: m._svgCache?.size };
  // pega um file qualquer do characters
  const ch = Object.values(m.characters ?? {})[0];
  out.sampleChar = ch ? { file: ch.file, size: ch.size, kind: ch.kind } : null;
  const file = ch?.file;
  if (file) {
    const svg = m._svgText(file);
    out.svgLen = svg?.length ?? null;
    out.svgHead = svg ? svg.slice(0, 200) : null;
    // testa decode manual
    const img = new Image();
    const ok = await new Promise((res) => {
      img.onload = () => res('load ' + img.naturalWidth + 'x' + img.naturalHeight);
      img.onerror = (e) => res('ERROR ' + (e?.message ?? 'onerror'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      setTimeout(() => res('TIMEOUT'), 5000);
    });
    out.manualDecode = ok;
    // e via _svgImage
    const viaCache = await m._svgImage(file);
    out.viaSvgImage = viaCache ? viaCache.naturalWidth + 'x' + viaCache.naturalHeight : 'null';
  }
  return out;
});
console.log(JSON.stringify(res, null, 1));
await b.close();
