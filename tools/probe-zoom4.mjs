import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const sizes = [[1280,720],[1920,1080],[2560,1440],[3840,2160]];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w,h] of sizes) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0,200)));
  await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000);
  const r = await p.evaluate(() => {
    const s = window.__penguin.scene;
    const cam = s.cameras.main;
    const cv = document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    return {
      ss: s._ss, zoom: cam.zoom, scrollX: Math.round(cam.scrollX),
      wv: Math.round(cam.worldView.width),
      canvas: [cv.width, cv.height], css: [Math.round(r.width), Math.round(r.height)],
      swlTex: s.swlKey ? (() => { const img = s.textures.get(`swl_atlas_${s.swlKey}_0`).getSourceImage(); return [img.width, img.height]; })() : null,
    };
  });
  console.log(`${w}x${h} ->`, JSON.stringify(r));
  await p.close();
}
await b.close();
