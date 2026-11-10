// QA visual: captura screenshots do clone (localhost:3000) e da referencia (gopenguin.lol)
// Uso: node qa-capture.mjs [sala]   (default: town)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const room = process.argv[2] || 'town';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', m => { if (m.type() === 'error') console.log('[clone-err]', m.text().slice(0, 200)); });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

// 1) Clone local
await page.goto(`http://localhost:3000/?room=${room}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(10000);
await page.screenshot({ path: path.join(__dirname, 'shots', `clone-${room}.png`) });
console.log('clone shot saved');

// 2) Referencia gopenguin.lol
await page.goto(`https://gopenguin.lol/?room=${room}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(8000);
// Tenta clicar em botao de play/entrar caso exista overlay
const btn = await page.$('button, [class*="play"], [class*="enter"], a');
if (btn) {
  try { await btn.click({ timeout: 2000 }); await page.waitForTimeout(8000); } catch {}
}
await page.screenshot({ path: path.join(__dirname, 'shots', `ref-${room}.png`) });
console.log('ref shot saved');

await browser.close();
