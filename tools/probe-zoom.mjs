import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const scene = window.__penguin && window.__penguin.scene;
  const cam = scene.cameras.main;
  return {
    zoom: cam.zoom, scrollX: cam.scrollX, scrollY: cam.scrollY,
    worldView: cam.worldView, ss: scene._ss,
    gameSize: [scene.game.config.width, scene.game.config.height],
    scaleSize: [scene.scale.width, scene.scale.height],
  };
});
console.log(JSON.stringify(info, null, 1));
await p.screenshot({ path: 'shots/probe-1080.png' });
await b.close();
