// dbg-hover.mjs <url> — inspeciona interacoes/hover no estado atual
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await p.goto(url, { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const m = s?.movie;
  const ia = s?._interactions;
  const out = {
    room: s?.currentRoom, pack: m?.base, kind: s?._primaryKind,
    buttons: ia?.buttons?.length ?? -1,
    btnPaths: (ia?.buttons || []).map((b) => b.path).slice(0, 20),
    playheads: m ? [...(m._playheads?.keys() || [])].filter((k) => /canopy|door|btn/i.test(k)).slice(0, 20) : [],
    gotoCanopy: m ? m.gotoPath('dance_canopy_mc', 2, false) : 'nomovie',
    forcedAfter: m ? [...(m._forcedPaths || [])] : [],
  };
  return out;
});
console.log(JSON.stringify(info, null, 1));
await b.close();
