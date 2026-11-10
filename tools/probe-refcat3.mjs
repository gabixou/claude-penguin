import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
const r = await p.evaluate(() => {
  const out = {};
  for (const k of Object.keys(window).filter(k => k.startsWith('penguin'))) {
    const o = window[k];
    out[k] = typeof o === 'object' && o ? Object.getOwnPropertyNames(Object.getPrototypeOf(o)).slice(0, 60) : typeof o;
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
