import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  const { assetMovie } = await import('/src/ui/paperDoll.js');
  const pm = await assetMovie('icons', 402);
  if (!pm) return 'no pm';
  const exportName = Object.keys(pm.data?.exports || {})[0];
  const spriteId = pm.data?.exports?.[exportName];
  const sprite = pm.sprites?.[spriteId];
  const entry = sprite?.frames?.[0]?.[0];
  const charId = String(entry?.id);
  const char = pm.characters?.[charId];
  const svgText = pm._svgText(char?.file);
  return {
    exportName, spriteId, entry, charId, char, svgTextLen: svgText?.length,
    files: Array.from(pm.files.keys()).slice(0, 5)
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
