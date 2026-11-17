import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage(); // viewport comum de laptop
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
await p.goto('http://localhost:3000/?room=coffee&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('beans'));
await p.waitForTimeout(8000);

const audit = await p.evaluate(() => {
  const out = { points: {}, layers: [] };
  // elemento do topo em varios pontos (cantos e bordas)
  for (const [name, x, y] of [['TL', 2, 2], ['TC', 683, 2], ['TR', 1363, 2], ['ML', 2, 384], ['MR', 1363, 384], ['BL', 2, 765], ['BC', 683, 765], ['BR', 1363, 765], ['C', 683, 384]]) {
    const el = document.elementFromPoint(x, y);
    out.points[name] = el ? el.tagName + (el.className ? '.' + String(el.className).slice(0, 30) : '') : 'NONE';
  }
  // fundo computado de cada camada
  const ifr = [...document.querySelectorAll('iframe')].find(f => /minigames/.test(f.src));
  const ov = ifr?.parentElement?.parentElement;
  out.layers.push(['overlay', getComputedStyle(ov).backgroundColor]);
  out.layers.push(['iframe-el', getComputedStyle(ifr).backgroundColor]);
  try {
    const idoc = ifr.contentDocument;
    out.layers.push(['index-html', getComputedStyle(idoc.documentElement).backgroundColor]);
    out.layers.push(['index-body', getComputedStyle(idoc.body).backgroundColor]);
    const gifr = idoc.querySelector('iframe.game-box');
    out.layers.push(['gamebox-el', gifr ? getComputedStyle(gifr).backgroundColor : 'missing']);
    out.layers.push(['gamebox-rect', gifr ? JSON.stringify(gifr.getBoundingClientRect()) : '-']);
    const gdoc = gifr?.contentDocument;
    if (gdoc) {
      out.layers.push(['game-html', getComputedStyle(gdoc.documentElement).backgroundColor]);
      out.layers.push(['game-body', getComputedStyle(gdoc.body).backgroundColor]);
      const game = gdoc.querySelector('.game');
      out.layers.push(['.game-rect', game ? JSON.stringify(game.getBoundingClientRect()) : '-']);
      out.layers.push(['.game-bg', game ? getComputedStyle(game).backgroundColor : '-']);
    }
  } catch (e) { out.layers.push(['err', e.message]); }
  return out;
});
console.log(JSON.stringify(audit, null, 1));
await p.screenshot({ path: 'tools/tools/shots/beans-1366.png' });
await b.close();
