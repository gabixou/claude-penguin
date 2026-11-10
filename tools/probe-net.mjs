import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('[' + m.type() + ']', m.text().slice(0, 200)); });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(120000);
const r = await p.evaluate(() => {
  const scene = window.__penguin.scene;
  return {
    sceneKey: scene.scene.key,
    hasMovie: !!scene.movie,
    movieLayers: scene.movieLayers?.length ?? null,
    swlChildren: scene.children.list.filter(c => c.texture?.key?.startsWith('swl')).length,
    movieImgs: scene.children.list.filter(c => c.texture?.key?.startsWith('movie_view')).length,
    bgVisible: scene.bg ? scene.bg.visible : null,
  };
});
console.log(JSON.stringify(r));
await b.close();
