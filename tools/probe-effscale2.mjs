import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForFunction(() => window.__penguin?.scene?.localPlayer?.view != null, null, { timeout: 30000 });

const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const lib = await scene.penguinLibrary;
  const out = { missKeys: new Set(), hitKeys: new Set(), missCalls: 0, hitCalls: 0 };
  const proto = Object.getPrototypeOf(lib.movie);
  const orig = proto.artCanvas;
  proto.artCanvas = function (file, ch, scale, bg) {
    const key = file + '|' + +scale.toFixed(3);
    const had = this._artCache && this._artCache.has(key);
    if (had) { out.hitCalls++; out.hitKeys.add(key); }
    else { out.missCalls++; out.missKeys.add(key); }
    return orig.call(this, file, ch, scale, bg);
  };
  const lp = scene.localPlayer;
  const targets = [[300, 400], [500, 300], [600, 450], [350, 350], [550, 380], [400, 420]];
  for (const [x, y] of targets) { lp.moveTo(x, y, 400); await new Promise(r => setTimeout(r, 900)); }
  await new Promise(r => setTimeout(r, 1500));
  proto.artCanvas = orig;
  const scales = {};
  for (const k of out.missKeys) { const s = k.split('|')[1]; scales[s] = (scales[s] || 0) + 1; }
  return { missCalls: out.missCalls, distinctMiss: out.missKeys.size, hitCalls: out.hitCalls, distinctHit: out.hitKeys.size, missScales: scales };
});
console.log(JSON.stringify(r));
await b.close();
