import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://localhost:3000/?room=shop', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.view, null, { timeout: 90000 });
await p.waitForFunction(() => { const sc = window.__penguin.scene; return sc.movie && sc.currentRoom === 'shop' && (!sc.loadingScreen || !sc.loadingScreen.visible); }, null, { timeout: 180000 });
// abre prompt direto
await p.evaluate(() => { const C = window.__penguin.scene.catalogue; C._prompt ??= new (Object.getPrototypeOf(C)._prompt?.constructor || function(){})(); });
// mais simples: chama _confirm via buy simulado — usa PromptUI via catalogue._confirm
await p.evaluate(() => window.__penguin.scene.catalogue._confirm('Would you like to buy Test Item for 20 coins. You currently have 1500 coins.', () => {}, true));
await p.waitForTimeout(2500);
const px = await p.evaluate(() => {
  // varre a tela do canvas procurando a regiao do prompt (pixels claros do painel)
  const cv = window.__penguin.scene.game.canvas;
  const ctx = cv.getContext('2d');
  // canvas backing pode ser maior que 760*ss; amostra na area central
  const W = cv.width, H = cv.height;
  let light = 0, total = 0;
  for (let y = Math.floor(H*0.3); y < H*0.7; y += 6)
    for (let x = Math.floor(W*0.3); x < W*0.7; x += 6) {
      const d = ctx.getImageData(x, y, 1, 1).data; total++;
      if (d[0] > 180 && d[1] > 180 && d[2] > 180) light++;
    }
  return { lightPct: Math.round(100*light/total), open: !!window.__penguin.scene.catalogue._prompt?.isOpen };
});
console.log(JSON.stringify(px));
await p.screenshot({ path: 'shots/prompt-direct.png' });
await b.close();
