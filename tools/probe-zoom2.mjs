import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(8000);
const r1 = await p.evaluate(() => {
  const scene = window.__penguin.scene;
  const cam = scene.cameras.main;
  cam.setZoom(2.25); cam.centerOn(380, 240);
  return { zoom: cam.zoom, scrollX: cam.scrollX, w: cam.worldView.width };
});
console.log('manual setZoom:', JSON.stringify(r1));
await p.waitForTimeout(500);
const r2 = await p.evaluate(() => {
  const cam = window.__penguin.scene.cameras.main;
  return { zoom: cam.zoom, scrollX: cam.scrollX, w: cam.worldView.width };
});
console.log('after 500ms:', JSON.stringify(r2));
// chama applySupersampling de novo forcando ss diferente? nao - testa se algo reseta
await p.waitForTimeout(2000);
const r3 = await p.evaluate(() => {
  const cam = window.__penguin.scene.cameras.main;
  return { zoom: cam.zoom, scrollX: cam.scrollX, w: cam.worldView.width };
});
console.log('after 2s:', JSON.stringify(r3));
await b.close();
