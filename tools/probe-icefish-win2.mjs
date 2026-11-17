import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  window.__rewards = [];
  const nc = window.__penguin.scene.network;
  const orig = nc.send.bind(nc);
  nc.send = (op, d) => { if (op === 'MINIGAME_REWARD') window.__rewards.push(d); return orig(op, d); };
});
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene._minigame._native._onPlay());
await p.waitForTimeout(800);
await p.evaluate(() => {
  const g = window.__penguin.scene._minigame._native;
  g.model.fishCaught = 60; g.model.orangeFish = 12; g.model.grayFish = 3;
  g.movie.goto('', 39, false);
  g._mullet();
});
// poll do playhead do sprite 444 e dos botoes por ~12s
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(1000);
  const st = await p.evaluate(() => {
    const g = window.__penguin.scene._minigame?._native;
    if (!g) return { gone: true };
    const h = g.movie._playheadAll ? [...g.movie._playheadAll.values()].find(x => x.sid === '444') : null;
    const btns = g._buttons().map(b => ({ path: b.path, rel: (b.release || '').replace(/\s+/g, ' ').slice(0, 60), b: b.bounds.map(v => Math.round(v)) }));
    return { f444: h?.frame, stopped: h?.stopped, main: g.movie._mainFrame, btns, overlay: !!window.__penguin.scene._minigame?.isOpen };
  });
  console.log(`t=${i + 1}s`, JSON.stringify(st));
  if (st.gone || !st.overlay) break;
}
await p.screenshot({ path: 'tools/shots/icefish-win-end.png' });
// tenta clicar no botao collect coins se existir
const clicked = await p.evaluate(() => {
  const g = window.__penguin.scene._minigame?._native;
  if (!g) return 'no-game';
  const btns = g._buttons();
  const b = btns.find(x => /getCoins|sendGameOver/.test(x.release || ''));
  if (!b) return 'no-button: ' + JSON.stringify(btns.map(x => x.path));
  const cx = (b.bounds[0] + b.bounds[2]) / 2, cy = (b.bounds[1] + b.bounds[3]) / 2;
  // converte stage->css pixels do canvas
  const r = g.canvas.getBoundingClientRect();
  const px = r.left + cx / 760 * r.width, py = r.top + cy / 480 * r.height;
  g.canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: px, clientY: py, bubbles: true }));
  return 'clicked ' + b.path + ' @' + Math.round(px) + ',' + Math.round(py);
});
console.log('click:', clicked);
await p.waitForTimeout(1500);
const fin = await p.evaluate(() => ({
  overlay: !!window.__penguin.scene._minigame?.isOpen,
  rewards: window.__rewards,
}));
console.log('final:', JSON.stringify(fin));
await b.close();
