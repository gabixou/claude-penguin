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

// conta chamadas _playIdx por idx por 6s, com um jelly hit no meio
const counts = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const cnt = {};
  const orig = g._playIdx.bind(g);
  g._playIdx = (idx) => { cnt[idx] = (cnt[idx] || 0) + 1; return orig(idx); };

  // dispara jelly hit real
  g.model.level = 2; g.model.mouseY = 300;
  g.movie.goto('jfish1', 3, true);
  const oh = g._hit.bind(g);
  g._hit = (a, bb) => /jfish/.test(a) ? true : oh(a, bb);
  await sleep(300);

  // Sample do playhead do sprite 214 (path provável 'penguin.#4' ou similar)
  const ph204 = () => {
    const out = [];
    for (const [k, h] of g.movie._playheadAll) if (String(h.sid) === '214') out.push({ path: k.split('')[0], frame: h.frame, muted: !!h.muted, stopped: h.stopped });
    return out;
  };
  const marks = [];
  for (let i = 0; i < 30; i++) {
    marks.push({ t: i * 200, ...(() => { const c = { ...cnt }; for (const k of Object.keys(cnt)) delete cnt[k]; return { delta: c }; })(), p214: ph204() });
    await sleep(200);
  }
  g._hit = oh;
  return { marks, total: cnt };
});
let prevMuted = null;
for (const m of counts.marks) {
  const d = Object.entries(m.delta).map(([k, v]) => `s${k}x${v}`).join(' ');
  const p = JSON.stringify(m.p214);
  if (d || p !== prevMuted) { console.log(`t=${m.t}ms ${d || '-'} 214=${p}`); prevMuted = p; }
}
await b.close();
