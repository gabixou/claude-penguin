// dbg-prod-zone.mjs — estado do ciclo dia/noite em producao
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
p.on('console', (m) => { if (/daynight|zone|plane/i.test(m.text())) console.log('[con]', m.text().slice(0, 160)); });
await p.goto('https://claudepenguin.mooo.com/', { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
await p.waitForTimeout(4000);
const st = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  return {
    room: s?.currentRoom, pack: s?.movie?.base, kind: s?._primaryKind,
    cycle: s?._cycleEnabled, zone: s?._zone, zoneP: s?._zoneP,
    planes: Object.keys(s?._planes || {}),
    weights: s?._zoneWeightsNow ? s._zoneWeightsNow() : null,
    port: location.port, override: (() => { try { return new URLSearchParams(location.search).get('daynight'); } catch { return null; } })(),
  };
});
console.log(JSON.stringify(st, null, 1));
await b.close();
