import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=pizza&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);

// 1) existe gatilho pizzatron no pack?
const trig = await p.evaluate(() => {
  const ci = window.__penguin.scene.movie?.interactions;
  const games = [];
  for (const [k, v] of Object.entries(ci?.click || {})) if (v?.game) games.push(['click', k, v.game]);
  for (const [k, v] of Object.entries(ci?.trigGame || {})) games.push(['trig', k, v]);
  return games;
});
console.log('gatilhos game:', JSON.stringify(trig));

// 2) abre overlay
const opened = await p.evaluate(() => window.__penguin.scene._showGameUnavailable('pizzatron'));
console.log('overlay open:', opened);
await p.waitForTimeout(9000); // loading + preload de assets

const st = await p.evaluate(() => {
  const f = document.querySelector('iframe');
  let inner = null;
  try {
    const g = f.contentWindow.document.querySelector('iframe.game-box');
    inner = g ? g.contentWindow : null;
  } catch (e) { inner = 'err:' + e.message; }
  const loop = window.__penguin.scene.game.loop;
  return { hasIframe: !!f, innerState: inner?.app?.currentState?.(), loopRunning: loop.running };
});
console.log('estado:', JSON.stringify(st));

// 3) clica Play se estiver no menu
const played = await p.evaluate(() => {
  const f = document.querySelector('iframe');
  const g = f.contentWindow.document.querySelector('iframe.game-box');
  const w = g.contentWindow, d = w.document;
  const btn = d.querySelector('.start-button');
  if (btn) { btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return 'clicked'; }
  return 'no-btn state=' + (w.app?.currentState?.());
});
console.log('play:', played);
await p.waitForTimeout(3000);
const st2 = await p.evaluate(() => {
  const f = document.querySelector('iframe');
  const g = f.contentWindow.document.querySelector('iframe.game-box');
  const w = g.contentWindow;
  return {
    state: w.app?.currentState?.(),
    hasGame: !!w.document.querySelector('.pizza-dough, .stats'),
    loopRunning: window.__penguin.scene.game.loop.running,
  };
});
console.log('durante jogo:', JSON.stringify(st2));
await p.screenshot({ path: 'tools/shots/pizzatron-test.png' });
await b.close();
