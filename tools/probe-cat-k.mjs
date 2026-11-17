import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk&room=town', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2500);
await p.evaluate(() => window.__penguin.scene.catalogue?.open?.('pets'));
await p.waitForTimeout(5000);
// instrumenta artCanvas para medir effs distintos por arquivo
const stats = await p.evaluate(async () => {
  const c = window.__penguin.scene.catalogue;
  const mv = c.movie;
  const effs = new Map(); // file -> Set<eff>
  const orig = mv.artCanvas.bind(mv);
  mv.artCanvas = function (file, ch, scale, bg) {
    if (!effs.has(file)) effs.set(file, new Set());
    effs.get(file).add(+scale.toFixed(3));
    return orig(file, ch, scale, bg);
  };
  // re-render pagina 1 forcando cache miss
  c._pageCache?.clear?.();
  await c._render(true);
  await new Promise(r => setTimeout(r, 3000));
  // distribuicao
  const dist = {};
  let totalFiles = 0, multi = 0;
  for (const [f, set] of effs) {
    totalFiles++;
    if (set.size > 1) multi++;
    for (const e of set) dist[e] = (dist[e] || 0) + 1;
  }
  return { totalFiles, multiEffFiles: multi, effHistogram: Object.entries(dist).sort((a,b)=>b[1]-a[1]).slice(0,20) };
});
console.log(JSON.stringify(stats, null, 1));
await b.close();
