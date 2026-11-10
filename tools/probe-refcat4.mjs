import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
await p.waitForTimeout(6000);
await p.screenshot({ path: 'shots/ref-cat-p0.png' });
const dump = async (tag) => {
  const c = await p.evaluate(() => {
    const pan = window.penguinPanels;
    const v = pan?.current ?? pan?.view;
    // procura objeto com controls/hits
    const cands = [v, pan?.panel, pan?.sheet, pan].filter(Boolean);
    for (const o of cands) {
      if (o.controls) return { where: 'controls', n: o.controls.length,
        list: o.controls.map(x => ({ l: x.label, r: x.rect })) };
      if (o.hits) return { where: 'hits', n: o.hits.length,
        list: o.hits.map(x => ({ l: x.label || x.id, r: x.rect })) };
    }
    return { keys: Object.keys(pan || {}) };
  });
  console.log(tag, JSON.stringify(c).slice(0, 3000));
};
await dump('p0');
// tenta achar e clicar "Next page"
const clickLabel = async (label) => {
  return await p.evaluate((label) => {
    const pan = window.penguinPanels;
    const stack = [pan?.current, pan?.panel, pan?.sheet, pan].filter(Boolean);
    for (const o of stack) {
      const arr = o.controls || o.hits;
      if (!arr) continue;
      const hit = arr.find(x => (x.label || '').toLowerCase().includes(label.toLowerCase()));
      if (hit?.rect) {
        const [x0,y0,x1,y1] = hit.rect;
        const ev = new MouseEvent('pointerdown', {clientX:(x0+x1)/2, clientY:(y0+y1)/2, bubbles:true});
        const ev2 = new MouseEvent('pointerup', {clientX:(x0+x1)/2, clientY:(y0+y1)/2, bubbles:true});
        (hit.action ? null : null);
        // gopenguin usa view.hit(x,y) — dispara via canvas? tenta click DOM no canvas
        return { rect: hit.rect, label: hit.label };
      }
    }
    return null;
  }, label);
};
console.log('nextbtn', JSON.stringify(await clickLabel('next')));
await b.close();
