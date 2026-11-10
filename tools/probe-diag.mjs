import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', m => console.log('CON[' + m.type() + ']', m.text().slice(0, 180)));
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
p.on('requestfailed', r => console.log('REQFAIL', r.url().slice(0, 120), r.failure()?.errorText));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(3000);
  const st = await p.evaluate(() => {
    const pg = window.__penguin;
    if (!pg) return { penguin: false };
    const s = pg.scene;
    return {
      penguin: true,
      scene: s?.scene?.key,
      ready: s?._movieReady,
      loader: s?.loadingScreen?.visible,
      layers: s?.movieLayers?.length,
      movie: !!s?.movie,
      playerReady: s?._playerReady,
      room: s?.currentRoom,
    };
  }).catch(e => ({ err: String(e).slice(0, 120) }));
  console.log(`t=${(i + 1) * 3}s`, JSON.stringify(st));
  if (st.ready) break;
}
await b.close();
