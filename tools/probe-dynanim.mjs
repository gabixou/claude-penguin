import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);

const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const snap = (canvas) => {
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 0;
    for (let i = 3; i < d.length; i += 400) h = (h * 31 + d[i]) | 0;
    return h;
  };
  const out = [];
  for (const d of (s._dynList || []).slice(0, 6)) {
    if (!d.canvas) { out.push({ path: d.path, skip: 'no canvas' }); continue; }
    const a = snap(d.canvas);
    await new Promise(r => setTimeout(r, 600));
    const c = snap(d.canvas);
    out.push({ path: d.path.split('.').pop(), changed: a !== c, hashA: a, hashB: c });
  }
  // conta renders de layer vs overlay num intervalo de 2s
  let layerRenders = 0, dynRenders = 0;
  const mv = s.movie;
  const origRL = mv.renderLayer.bind(mv);
  mv.renderLayer = (...a) => { layerRenders++; return origRL(...a); };
  const origDyn = mv.renderSpriteDynamic.bind(mv);
  mv.renderSpriteDynamic = (...a) => { dynRenders++; return origDyn(...a); };
  await new Promise(r => setTimeout(r, 2000));
  return { anim: out, layerRendersPer2s: layerRenders, dynRendersPer2s: dynRenders };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
