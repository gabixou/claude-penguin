import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: EXE, headless: true });
// clone: paginas densas 15 e 17
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
  await p.evaluate(() => window.__penguin.scene.changeRoom('shop', 500, 280));
  await p.waitForFunction(() => { const s = window.__penguin.scene; return s.currentRoom === 'shop' && s._movieReady === true; }, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
  await p.waitForFunction(() => (window.__penguin.scene.catalogue?._pageCache?.size || 0) > 0, null, { timeout: 120000 });
  for (const n of [15, 17]) {
    await p.evaluate((pg) => {
      const c = window.__penguin.scene.catalogue;
      c.movie.goto('book', pg);
      c._show();
    }, n);
    await p.waitForFunction((pg) => window.__penguin.scene.catalogue.movie.currentFrame('book') === pg && !window.__penguin.scene.catalogue._rendering, n, { timeout: 120000 });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `shots/clone-cat-p${n}.png` });
  }
  await p.close();
}
// ref: mesmas paginas
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(15000);
  await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
  await p.waitForTimeout(6000);
  for (const n of [15, 17]) {
    await p.evaluate((pg) => window.penguinPanels?.current?.spec?.movie?.goto?.('book', pg), n);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `shots/ref-cat-p${n}.png` });
  }
  await p.close();
}
await b.close();
console.log('done');
