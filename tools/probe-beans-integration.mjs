import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(3000);

// abre o minigame pelo caminho real (_showGameUnavailable -> MinigameOverlay)
const opened = await p.evaluate(() => {
  const s = window.__penguin.scene;
  s._showGameUnavailable('beans');
  return !!document.querySelector('iframe[src*="beancounters"]');
});
console.log('overlay abriu com beancounters:', opened);
await p.waitForTimeout(9000); // preload do jogo

// clica Play dentro do iframe aninhado
const play = await p.evaluate(() => {
  const outer = document.querySelector('iframe[src*="beancounters"]');
  const inner = outer.contentDocument.querySelector('iframe.game-box');
  const d = inner.contentDocument, w = inner.contentWindow;
  const btn = d.querySelector('.start-button');
  if (btn) { btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return 'clicked'; }
  return 'no btn state=' + w.app?.currentState?.();
});
console.log('play:', play);
await p.waitForTimeout(2000);

// escuta mensagens na janela principal e dispara level-complete fake
await p.evaluate(() => {
  window.__gotMsg = null;
  window.addEventListener('message', (e) => {
    if (e.data && e.data.source === 'beancounters') window.__gotMsg = e.data;
  });
});
const msg = await p.evaluate(() => {
  const outer = document.querySelector('iframe[src*="beancounters"]');
  const inner = outer.contentDocument.querySelector('iframe.game-box');
  inner.contentWindow.bcMsg('level-complete', { level: 3 });
  return 'sent';
});
await p.waitForTimeout(500);
const got = await p.evaluate(() => window.__gotMsg);
console.log('relay level-complete:', JSON.stringify(got));

// screenshot do overlay com o jogo rodando
await p.screenshot({ path: 'tools/shots/beancounters-ingame.png' });
await b.close();
