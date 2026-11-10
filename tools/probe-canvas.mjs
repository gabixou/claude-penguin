import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(8000);
const info = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const scene = window.__penguin && window.__penguin.scene;
  const cam = scene && scene.cameras && scene.cameras.main;
  return {
    canvas: c ? { w: c.width, h: c.height, cssW: c.style.width } : null,
    zoom: cam ? cam.zoom : null,
    scroll: cam ? { x: cam.scrollX, y: cam.scrollY } : null,
    penguin: window.__penguin ? { x: window.__penguin.x, y: window.__penguin.y } : null,
  };
});
console.log(JSON.stringify(info));
await b.close();
