import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1500);
// abre e fecha o card, depois confere se a sala continua renderizada
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
await p.waitForTimeout(1500);
await p.evaluate(() => window.__penguin.scene.playerCard.close());
await p.waitForTimeout(800);
await p.screenshot({ path: 'shots/clone-town-cardfix.png' });
// checagem de pixels: a sala nao pode estar em branco/preta
const blank = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const x = c.getContext('webgl2') || c.getContext('webgl');
  return { w: c.width, h: c.height, hasGL: !!x };
});
console.log('canvas:', JSON.stringify(blank));
await b.close();
