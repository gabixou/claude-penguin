import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: EXE, headless: true });

// ---------- clone (:3100 preview do build novo) ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => console.log('CLONE PAGEERR', String(e).slice(0, 120)));
  await p.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
  await p.evaluate(() => window.__penguin.scene.changeRoom('shop', 500, 280));
  await p.waitForFunction(() => { const s = window.__penguin.scene; return s.currentRoom === 'shop' && s._movieReady === true; }, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__penguin.scene.openContent('clothing_catalogue'));
  await p.waitForFunction(() => (window.__penguin.scene.catalogue?._pageCache?.size || 0) > 0, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'shots/clone-cat-p1.png' });
  for (let i = 2; i <= 4; i++) {
    await p.evaluate(() => {
      const c = window.__penguin.scene.catalogue;
      const btn = c.controls.find((x) => x.label === 'Next page');
      if (btn?.action) btn.action();
    });
    await p.waitForFunction((prev) => window.__penguin.scene.catalogue.movie.currentFrame('book') !== prev, i - 1, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(2500); // tempo de leitura p/ warm drenar
    await p.screenshot({ path: `shots/clone-cat-p${i}.png` });
  }
  await p.close();
}

// ---------- referencia (gopenguin.lol) ----------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('REF PAGEERR', String(e).slice(0, 120)));
  await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(15000);
  await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
  await p.waitForTimeout(6000);
  await p.screenshot({ path: 'shots/ref-cat-p1.png' });
  const rectOf = (label) => p.evaluate((label) => {
    const c = window.penguinPanels?.current;
    const hit = (c?.spec?.controls || []).find((x) => (x.label || '').includes(label));
    return hit?.rect || null;
  }, label);
  const clickCtl = async (label) => {
    const r = await rectOf(label);
    if (!r) return false;
    const [x0, y0, x1, y1] = r;
    await p.mouse.click(((x0 + x1) / 2) * (1280 / 760), ((y0 + y1) / 2) * (720 / 480));
    await p.waitForTimeout(1500);
    return true;
  };
  for (let i = 2; i <= 4; i++) {
    await clickCtl('Next page');
    await p.screenshot({ path: `shots/ref-cat-p${i}.png` });
  }
  await p.close();
}
await b.close();
console.log('done');
