import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(8000);
// forca re-execucao do applySupersampling
const r = await p.evaluate(() => {
  const scene = window.__penguin.scene;
  scene._ss = 0;
  try { scene.applySupersampling(); } catch (e) { return { err: String(e) }; }
  const cam = scene.cameras.main;
  return { ss: scene._ss, zoom: cam.zoom, scrollX: cam.scrollX, w: cam.worldView.width };
});
console.log('forced applySS:', JSON.stringify(r));
await p.waitForTimeout(500);
const r2 = await p.evaluate(() => {
  const cam = window.__penguin.scene.cameras.main;
  return { zoom: cam.zoom, scrollX: cam.scrollX, w: cam.worldView.width };
});
console.log('after 500ms:', JSON.stringify(r2));
await b.close();
