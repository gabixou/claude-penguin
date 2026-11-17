import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);

// 1) idle screenshot
await p.screenshot({ path: 'shots/nc-idle.png' });

// 2) infos dos botoes + hover real via pointermove na posicao do botao
const info = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const m = scene.movie;
  const inter = scene._interactions;
  const btns = inter.buttons.map(b => ({ path: b.path, bounds: b.bounds.map(v => +v.toFixed(1)) }));
  const dance = inter.buttons.find(b => b.path.includes('dance_btn'));
  const out = { btns, danceBounds: dance?.bounds, hoveredBefore: inter.hovered };
  // converte bounds mundo -> screen e move o mouse de verdade
  const cam = scene.cameras.main;
  const [x0, y0, x1, y1] = dance.bounds;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // world->screen: canvas offset + scale. usa pointer.worldX equivalente:
  // worldX = (screenX - offsetX)/scale com scale = canvas.displayWidth/760?
  // mais seguro: chama hoverAt direto em coords de mundo
  inter.hoverAt(cx, cy);
  out.hoveredAfter = inter.hovered;
  out.state = m._buttonStates.get(dance.path);
  await new Promise(r => setTimeout(r, 300));
  // playheads dance_btn
  out.dancePlayheads = {};
  const ph = m._playheadsAll instanceof Map ? [...m._playheadsAll.entries()] : Object.entries(m._playheadsAll || {});
  for (const [k, v] of ph) if (k.includes('dance_btn')) out.dancePlayheads[k] = { frame: v.frame, stopped: v.stopped };
  out.canopyFrame = m._playheads.get('dance_canopy_mc')?.frame;
  // dynamics?
  out.dyns = (scene._dynImages || []).map(d => d.path).filter(x => x.includes('dance'));
  return out;
});
console.log(JSON.stringify(info, null, 1));

await p.waitForTimeout(1200);
await p.screenshot({ path: 'shots/nc-hover.png' });

// 3) hover out
await p.evaluate(() => { const s = window.__penguin.scene; s._interactions.hoverAt(-999, -999); });
await p.waitForTimeout(600);
await p.screenshot({ path: 'shots/nc-hoverout.png' });
await b.close();
