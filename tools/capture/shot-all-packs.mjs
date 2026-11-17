import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const shots = [
  ['town','hp2008-hptown'],['plaza','hp2008-hpplaza'],['dock','hp2008-hpdock'],
  ['beach','hp2008-hpbeach'],['cove','hp2008-hpcove'],['forest','hp2008-hpforest'],
  ['dojo','hp2008-hpdojo'],['berg','hp2008-hpiceberg'],['mtn','hp2008-hpskihill'],
  ['village','hp2008-hpskivillage'],['forts','hp2008-hpsnowforts'],
];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [room, pack] of shots) {
  const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
  const url = `http://localhost:3000/?room=${room}&moviepack=${pack}`;
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(10000);
    let ok = false;
    try {
      ok = await p.waitForFunction(() => {
        const s = window.__penguin?.scene;
        const m = s?.movie;
        return m && (m._playheads?.size > 0 || m.files?.size > 50);
      }, { timeout: 45000 }).then(() => true).catch(() => false);
    } catch {}
    const st = await p.evaluate(() => {
      const s = window.__penguin?.scene;
      return { movie: !!s?.movie, room: s?.currentRoom, ph: s?.movie?._playheads?.size, files: s?.movie?.files?.size };
    }).catch(() => null);
    console.log('state', pack, JSON.stringify(st), 'ready:', ok);
    await p.waitForTimeout(4000);
    const out = `E:\\project\\cp-halloween-swfs\\shots\\${pack}.png`;
    await p.screenshot({ path: out });
    console.log('OK', pack);
  } catch (e) { console.log('FAIL', pack, String(e).slice(0,120)); }
  await p.close();
}
await b.close();
console.log('DONE');
