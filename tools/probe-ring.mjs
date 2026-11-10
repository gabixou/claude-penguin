import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 120; i++) {
  const ok = await p.evaluate(() => {
    const s = window.__penguin && window.__penguin.scene;
    return !!(s && s.localPlayer && s.localPlayer.view);
  }).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
const r = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const v = s.localPlayer.view;
  return {
    ringState: v.art.state.get('ring'),
    stateKeys: [...v.art.state.keys()],
    hasRingEntry: (v.art.data.main?.frames?.[0] || []).some(e => e.name === 'ring'),
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
