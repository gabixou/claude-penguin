import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 400)));
p.on('console', m => { const t = m.text(); if (!t.includes('vite') && !t.includes('Phaser v')) console.log('[' + m.type() + ']', t.slice(0, 250)); });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(20000);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const out = { hasMovie: !!scene.movie, fail: !!scene.roomFailText,
                camBg: scene.cameras.main.backgroundColor ? scene.cameras.main.backgroundColor.color : null };
  // fetch com timeout para nao ficar pendurado
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const t0 = performance.now();
    const resp = await fetch('/assets/movies/town/timelines.json', { signal: ctrl.signal });
    out.tlStatus = resp.status; out.tlMs = Math.round(performance.now() - t0);
  } catch (e) { out.fetchErr = String(e).slice(0, 120); }
  return out;
});
console.log('RESULT', JSON.stringify(r));
await b.close();
