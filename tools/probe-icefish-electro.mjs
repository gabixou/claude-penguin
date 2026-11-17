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
await p.waitForTimeout(800);

// arma jfish1 num frame >1 e forca o hit-test so p/ jfish
await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  g.model.level = 2; g.model.mouseY = 300;
  g.movie.goto('jfish1', 3, true);
  const orig = g._hit.bind(g);
  g._hit = (a, bb) => /jfish/.test(a) ? true : orig(a, bb);
  window.__origHit = orig;
});
await p.waitForFunction(() => {
  const g = window.__penguin.scene._minigame._native;
  return g.model.isHit === true;
}, null, { timeout: 10000 });
console.log('JELLY HIT FIRED');

// amostra a sequencia por ~4s
const seq = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = [];
  for (let i = 0; i < 24; i++) {
    const eh = g.movie._playheads.get('hook.electro');
    out.push({
      t: i * 200,
      hook: g._frame('hook'),
      electro: eh?.frame ?? null,
      electroStopped: eh?.stopped ?? null,
      prompt: g._frame('prompt'),
      isHit: g.model.isHit, lives: g.model.lives,
      penguin: g._frame('penguin'), line: g._frame('line'),
    });
    await sleep(200);
  }
  return out;
});
// imprime transicoes apenas
let prev = '';
for (const s of seq) {
  const key = `${s.hook}|${s.electro}|${s.electroStopped}|${s.prompt}|${s.isHit}|${s.lives}|${s.penguin}|${s.line}`;
  if (key !== prev) { console.log(JSON.stringify(s)); prev = key; }
}

// restaura _hit e clica no botao worm com mouseY<=152
const worm = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  g._hit = window.__origHit;
  g.model.mouseY = 100;
  await sleep(400);
  const btn = g._buttons().find(b => /getWorm/.test(b.release));
  if (!btn) return { found: false, btns: g._buttons().map(b => b.path) };
  const [x0, y0, x1, y1] = btn.bounds;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const r = g.canvas.getBoundingClientRect();
  const opts = { clientX: r.left + cx / 760 * r.width, clientY: r.top + cy / 480 * r.height, bubbles: true };
  g.canvas.dispatchEvent(new MouseEvent('mousedown', opts));
  g.canvas.dispatchEvent(new MouseEvent('mouseup', opts));
  await sleep(600);
  return { found: true, isHit: g.model.isHit, lives: g.model.lives, hook: g._frame('hook'), penguin: g._frame('penguin'), prompt: g._frame('prompt'), hookVisible: g.movie._playheads.get('hook') ? true : null };
});
console.log('WORM:', JSON.stringify(worm));
// espera mais 1s e confirma que nada re-dispara (hook nao volta a 50, lives nao cai)
const after = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  await sleep(1200);
  return { hook: g._frame('hook'), lives: g.model.lives, isHit: g.model.isHit, prompt: g._frame('prompt'), penguin: g._frame('penguin') };
});
console.log('AFTER:', JSON.stringify(after));
await b.close();
