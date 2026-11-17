import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());

const result = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame?._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const hookX = 367;
  const seen = { puffleFrames: new Set(), levelUps: [], maxLevel: 1 };
  seen.lineSvg = g.movie._svgText('148.svg')?.includes('stroke-width="1"');
  let lastLevel = 1;
  for (let i = 0; i < 900; i++) {
    const m = g.model;
    if (!m.running) break;
    seen.puffleFrames.add(g._frame('puffle'));
    if (m.level !== lastLevel) { seen.levelUps.push({ from: lastLevel, to: m.level, caught: m.fishCaught, t: i }); lastLevel = m.level; }
    seen.maxLevel = Math.max(seen.maxLevel, m.level);
    const hookF = g._frame('hook');
    if (hookF === 5 || hookF === 7) {
      g.model.mouseY = 100;
      await sleep(400);
      g._fishDrop(); g._newWorm(0);
      await sleep(300);
      continue;
    }
    let best = null;
    for (let n = 1; n <= 8; n++) {
      if (g._frame('fish' + n) <= 1) continue;
      const hb = g._box('fish' + n + '.obj.hotspot');
      if (!hb) continue;
      const cx = (hb[0] + hb[2]) / 2, cy = (hb[1] + hb[3]) / 2;
      const dist = Math.abs(cx - hookX);
      if (!best || dist < best.dist) best = { dist, cy, n };
    }
    if (best && best.dist < 60) {
      g.model.mouseY = best.cy;
      if (best.dist < 30) { g._fishDrop(); g._newWorm(0); }
    }
    await sleep(100);
  }
  const m = g.model;
  return { running: m.running, over: m.over, caught: m.fishCaught, level: m.level, maxLevel: seen.maxLevel,
    levelUps: seen.levelUps, puffleFrames: [...seen.puffleFrames].sort((a, b) => a - b).slice(0, 20),
    puffleFrameCount: seen.puffleFrames.size, lineSvgOverride: seen.lineSvg, coins: g._coins() };
});
console.log('resultado:', JSON.stringify(result));
const px = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  if (!g) return null;
  const ctx = g.canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, g.canvas.width, g.canvas.height).data;
  // a linha e vertical perto de x=734 (stage 367*2), do topo da vara ate o
  // hook. Procura a coluna com mais pixels escuros na faixa x 690..780.
  const perCol = [];
  for (let x = 690; x <= 780; x++) {
    let dark = 0;
    for (let y = 60; y < 760; y += 2) {
      const i = (y * g.canvas.width + x) * 4;
      if (d[i] < 80 && d[i + 1] < 80 && d[i + 2] < 80) dark++;
    }
    perCol.push({ x, dark });
  }
  perCol.sort((a, b2) => b2.dark - a.dark);
  return { top3: perCol.slice(0, 3) };
});
console.log('colunas mais escuras (linha?):', JSON.stringify(px));
await p.screenshot({ path: 'tools/shots/icefish-levelup.png' });
await b.close();
