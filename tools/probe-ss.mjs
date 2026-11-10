// Verifica supersampling adaptativo em varios viewports: node probe-ss.mjs
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }, { width: 3840, height: 2160 }]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000);
  const info = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const cam = window.__penguin?.scene?.cameras?.main;
    const scene = window.__penguin?.scene;
    const layer = scene?.swlLayers?.[0];
    const src = layer ? scene.textures.get(layer.texKey).getSourceImage() : null;
    return {
      canvas: c ? [c.width, c.height] : null,
      css: c ? [Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)] : null,
      zoom: cam?.zoom,
      swlTex: src ? [src.width, src.height] : null,
    };
  });
  console.log(`${vp.width}x${vp.height} ->`, JSON.stringify(info));
  await p.close();
}
await b.close();
