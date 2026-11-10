// Verifica camadas SWL e depth sorting: node qa-probe.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';

const browser = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);

const info = await page.evaluate(() => {
  const p = window.__penguin;
  const scene = p?.scene;
  if (!scene) return { err: 'penguin/scene nao achada' };
  return {
    layers: (scene.swlLayers || []).map(l => ({ depth: +l.img.depth.toFixed(3), span: [l.start, l.end] })),
    penguinDepth: p ? +p.depth.toFixed(3) : null,
    penguinPos: p ? { x: Math.round(p.x), y: Math.round(p.y) } : null,
    hudDepth: scene.gpHud ? scene.gpHud.depth : null,
  };
});
console.log(JSON.stringify(info, null, 2));

await page.evaluate(() => { if (window.__penguin) { window.__penguin.setPosition(380, 450); window.__penguin.updateDepth(); } });
await page.waitForTimeout(400);
console.log('depth@450:', await page.evaluate(() => window.__penguin?.depth));
await page.screenshot({ path: path.join(__dirname, 'shots', 'probe-town-bottom.png') });
await page.evaluate(() => { if (window.__penguin) { window.__penguin.setPosition(380, 120); window.__penguin.updateDepth(); } });
await page.waitForTimeout(400);
console.log('depth@120:', await page.evaluate(() => window.__penguin?.depth));
await page.screenshot({ path: path.join(__dirname, 'shots', 'probe-town-top.png') });
await browser.close();
