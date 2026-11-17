// dbg-tz.mjs — que horas o browser headless acha que sao em SP
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage();
await p.goto('https://claudepenguin.mooo.com/', { waitUntil: 'domcontentloaded' });
const r = await p.evaluate(() => {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour12: false, hour: '2-digit', minute: '2-digit' });
  return {
    sp: fmt.format(Date.now()),
    utc: new Date().toISOString(),
    local: new Date().toString(),
    tzOffset: new Date().getTimezoneOffset(),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
