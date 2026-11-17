import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(1200);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForFunction(() => window.__penguin.scene._minigame?._native?.movie, null, { timeout: 60000 });
await p.waitForTimeout(800);
const out = await p.evaluate(async () => {
  const g = window.__penguin.scene._minigame._native;
  const m = g.movie;
  const log = [];
  g._onPlay();
  await new Promise(r => setTimeout(r, 500));
  const sp = m.sprites['444'];
  log.push('sprite444 sounds:', JSON.stringify(sp?.sounds?.length), 'frames:', sp?.frames?.length);
  const ok = m.goto('puffle', 47, true);
  m.tick();
  log.push('gotoRet:', ok, 'queue:', JSON.stringify(m._sndQueue));
  m.drainSounds();
  // sprite 317 (puffle) tem sons nos frames 47/184 -> conv 242
  const sp317 = m.sprites['317'];
  log.push('sprite317 sounds:', JSON.stringify(sp317?.sounds));
  // descobre paths de playheads ativos
  log.push('paths:', JSON.stringify([...m._playheadAll.keys()].slice(0, 30)));
  return log;
});
console.log(out.join('\n'));
await b.close();
