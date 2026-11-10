import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
await p.waitForTimeout(6000);
const rectOf = async (label) => p.evaluate((label) => {
  const c = window.penguinPanels?.current;
  const hit = (c?.spec?.controls || []).find(x => (x.label || '').includes(label));
  return hit?.rect || null;
}, label);
const clickCtl = async (label) => {
  const r = await rectOf(label);
  if (!r) return null;
  const [x0, y0, x1, y1] = r;
  // rects estao em coords do mundo 760x480? ou css? tenta ambos
  for (const [sx, sy] of [[1, 1], [1280 / 760, 720 / 480]]) {
    await p.mouse.click((x0 + x1) / 2 * sx, (y0 + y1) / 2 * sy);
    await p.waitForTimeout(400);
  }
  return r;
};
const frame = async () => p.evaluate(() => {
  const mv = window.penguinPanels?.current?.spec?.movie;
  return mv?.currentFrame ? mv.currentFrame('book') : null;
});
console.log('p0 frame', await frame());
await p.screenshot({ path: 'shots/refcat2-p0.png' });
for (let i = 1; i <= 5; i++) {
  const r = await clickCtl('Next page');
  await p.waitForTimeout(1200);
  console.log('clicked next, rect', JSON.stringify(r), 'frame', await frame());
  await p.screenshot({ path: `shots/refcat2-p${i}.png` });
}
await b.close();
