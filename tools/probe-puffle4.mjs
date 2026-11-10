import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000/minigames/pufflescape/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
const r = await p.evaluate(() => {
  const g = (window.Phaser?.GAMES || [])[0];
  if (!g) return { game: false };
  return {
    game: true,
    scenes: g.scene.getScenes(true).map(s => s.scene.key),
    textures: Object.keys(g.textures.list).length,
    pending: g.scene.isActive('Boot') ? 'boot' : 'other',
  };
});
console.log(JSON.stringify({ r, errs: errs.slice(0,3) }));
await p.screenshot({ path: 'shots/puffle-boot3.png' });
await b.close();
