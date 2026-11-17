// dbg-zone-watch.mjs — amostra _zone/_zoneP a cada 5s por ~75s em prod
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
await p.goto('https://claudepenguin.mooo.com/', { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
for (let i = 0; i < 15; i++) {
  const st = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour12: false, hour: '2-digit', minute: '2-digit' });
    return { zone: s?._zone, zp: s?._zoneP?.toFixed(2), sp: fmt.format(Date.now()), pack: s?.movie?.base };
  });
  console.log(new Date().toISOString().slice(11, 19), JSON.stringify(st));
  await p.waitForTimeout(5000);
}
await b.close();
