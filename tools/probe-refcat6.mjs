import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
await p.waitForTimeout(6000);
const r = await p.evaluate(() => {
  const c = window.penguinPanels?.current;
  const s = c?.spec;
  if (!s) return null;
  const out = { specKeys: Object.keys(s) };
  for (const k of Object.keys(s)) {
    const v = s[k];
    out[k] = typeof v === 'object' && v ? (v.constructor?.name + ':' + Object.keys(v).slice(0,15).join(',')) : typeof v;
  }
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 4000));
await b.close();
