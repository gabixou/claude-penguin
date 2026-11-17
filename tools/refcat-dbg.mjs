import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
await p.waitForTimeout(6000);
const info = await p.evaluate(() => {
  const c = window.penguinPanels?.current;
  const ctl = c?.spec?.controls?.find((x) => (x.label || '').includes('Next'));
  return {
    ctlKeys: ctl ? Object.keys(ctl) : null,
    ctl: ctl ? JSON.stringify(ctl).slice(0, 800) : null,
    movieKeys: c?.spec?.movie ? Object.keys(c.spec.movie).slice(0, 40) : null,
  };
});
console.log(JSON.stringify(info, null, 1));
// tenta goto direto
const r = await p.evaluate(() => {
  const mv = window.penguinPanels?.current?.spec?.movie;
  try { mv?.goto?.('book', 2); return 'goto ok'; } catch (e) { return 'goto err ' + e; }
});
console.log(r);
await p.waitForTimeout(2000);
console.log('frame', await p.evaluate(() => window.penguinPanels?.current?.spec?.movie?.currentFrame?.('book')));
await p.screenshot({ path: 'shots/ref-cat-p2.png' });
await b.close();
