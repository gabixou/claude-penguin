import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene._showGameUnavailable('roundup'));
await p.waitForTimeout(14000); // tempo do boot do minigame (pack ~18MB)
const r = await p.evaluate(() => {
  const f = document.querySelector('iframe[src*="pufflescape"]');
  if (!f) return { iframe: false };
  const d = f.contentDocument;
  const cv = d?.querySelector('canvas');
  return { iframe: true, canvas: !!cv, w: cv?.width, h: cv?.height, scenes: (() => { try { return Object.keys(d.defaultView.Phaser?.GAMES?.[0]?.scene?.keys || {}); } catch(e){ return 'n/a'; } })() };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'shots/puffle-overlay.png' });
await b.close();
