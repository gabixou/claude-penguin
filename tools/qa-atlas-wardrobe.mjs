// QA wardrobe: abre wardrobe direto e verifica icons/<id> via atlas
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
const hits = [];
page.on('request', (r) => { const u = r.url(); if (/atlas-\d+\.png/.test(u) && (u.includes('/icons/') || u.includes('/paper/'))) hits.push(u.split('/assets/')[1]); });
await page.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(22000);
const scene = `(() => { const g = window.__game || window.game; return Object.values(g.scene.keys).find((s) => s.localPlayer); })()`;
await page.evaluate(`(() => { const s = ${scene}; s.wardrobe.open(s.localPlayer); })()`);
await page.waitForTimeout(8000);
const c = await page.evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
try { await page.screenshot({ path: path.join(__dirname, "shots", "atlas-wardrobe.png"), clip: c }); } catch { await page.screenshot({ path: path.join(__dirname, "shots", "atlas-wardrobe.png") }); }
console.log('icons/paper atlas pngs:', [...new Set(hits)].length);
for (const u of [...new Set(hits)].slice(0, 12)) console.log(' ', u);
await browser.close();
