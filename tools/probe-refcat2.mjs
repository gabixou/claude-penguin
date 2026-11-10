import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
const r = await p.evaluate(() => {
  const out = {};
  for (const k of ['penguinPanels', 'penguinWorld', 'penguinHud', 'penguinOverlay']) {
    const o = window[k];
    if (!o) { out[k] = null; continue; }
    out[k] = Object.getOwnPropertyNames(Object.getPrototypeOf(o)).concat(Object.keys(o)).filter((v,i,a)=>a.indexOf(v)===i).slice(0,80);
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
