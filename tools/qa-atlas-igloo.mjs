// Igloo: verifica mobília renderizada via atlas
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1039, height: 551 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
const atlasReqs = [];
page.on('request', (r) => { if (r.url().includes('atlas-')) atlasReqs.push(r.url()); });
await page.goto('http://localhost:3000/?room=igloo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(30000);
const c = await page.evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
await page.screenshot({ path: path.join(__dirname, "shots", "atlas-igloo.png") });
console.log('atlas reqs:', atlasReqs.length);
const byBase = {};
for (const u of atlasReqs) { const m = u.split('/assets/')[1]?.split('/chars/')[0]; byBase[m] = (byBase[m] || 0) + 1; }
console.log(byBase);
await browser.close();
