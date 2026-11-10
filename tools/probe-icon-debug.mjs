import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', m => console.log('CON:', m.text()));
p.on('pageerror', e => console.log('ERR:', e.message));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  const s = window.__penguin.scene;
  const { assetMovie } = await import('/src/ui/paperDoll.js');
  const pm = await assetMovie('icons', 402);
  if (!pm) return 'pm null';
  return {
    hasSprites: !!pm.sprites,
    spriteKeys: Object.keys(pm.sprites || {}),
    exports: pm.data?.exports,
    characters: Object.keys(pm.characters || {}),
    char1: pm.characters?.['1'],
    mainFrames: pm.data?.main?.frames?.length,
    hasArtCanvas: typeof pm.artCanvas
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
