import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const g = window.__penguin;
  const scene = g?.scene?.scene?.keys ? Object.values(g.scene.scene.keys).find(s => s.scene.key === 'BootScene' || s.scene.isActive()) : null;
  const tex = g?.textures?.exists?.('logo');
  return { hasGame: !!g, texLogo: tex, active: g?.scene?.isActive?.('BootScene') };
});
console.log(JSON.stringify(r));
await b.close();
