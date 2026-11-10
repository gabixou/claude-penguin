import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
await p.waitForTimeout(6000);
const r = await p.evaluate(() => {
  const pan = window.penguinPanels;
  const c = pan?.current;
  if (!c) return { cur: null, keys: Object.keys(pan || {}) };
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(c));
  const own = Object.keys(c);
  return { ctor: c.constructor?.name, proto: proto.slice(0, 60), own: own.slice(0, 60),
    hasMovie: !!c.movie, hasCommands: typeof c.commands, page: c.page, visiblePage: c.visiblePage };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
