import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await (await b.newContext({ viewport: { width: 1520, height: 960 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERR:', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await p.goto('http://localhost:3000/?room=lodge&guest=1', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 120000 });
await p.waitForTimeout(2000);
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('fish'));
await p.waitForTimeout(6000);

const g = await p.evaluate(() => {
  const n = window.__penguin.scene._minigame?._native;
  return {
    native: !!n,
    domBtns: n ? n.frame.querySelectorAll('div[style*="border-radius"]').length : -1,
    buttons: n ? n._buttons().map(b => ({ path: b.path.split('.').slice(-2).join('.'), rel: b.release.replace(/\s+/g, ' ').slice(0, 60), b: b.bounds.map(v => Math.round(v)) })) : [],
  };
});
console.log(JSON.stringify(g, null, 1));

// clica no play_btn (bounds -> coords do canvas 1520x960)
const play = g.buttons.find(x => /play/.test(x.rel));
if (play) {
  const [x0, y0, x1, y1] = play.b;
  const cx = ((x0 + x1) / 2) * 2, cy = ((y0 + y1) / 2) * 2; // stage 760x480 -> canvas 1520x960
  await p.mouse.click(cx, cy);
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => {
    const n = window.__penguin.scene._minigame?._native;
    return { started: n?.started, running: n?.model?.running, frame: n?.movie?._mainFrame };
  });
  console.log('apos play:', JSON.stringify(st));
  await p.screenshot({ path: 'tools/tools/shots/icefish-nativebtns.png' });
}
await b.close();
