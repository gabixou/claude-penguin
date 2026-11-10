// Captura um screenshot simples: node qa-shot.mjs <url> <out.png> [waitMs]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [url, out, waitMs] = process.argv.slice(2);
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(Number(waitMs) || 9000);
await page.screenshot({ path: path.join(__dirname, out || 'shot.png') });
await browser.close();
console.log('saved', out);
