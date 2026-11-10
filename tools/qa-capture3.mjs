import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const room = process.argv[2] || 'town';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const W = 1280, H = 720;
const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto(`http://localhost:3000/?room=${room}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(90000);
// freeze the game loop so the compositor can grab a static frame
await page.evaluate(() => {
  const g = window.game || (window.Phaser && window.Phaser.GAMES && window.Phaser.GAMES[0]);
  const game = g || (window.__penguin && window.__penguin.scene && window.__penguin.scene.game);
  if (game && game.loop) game.loop.sleep();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(__dirname, 'shots', `clone-${room}.png`), timeout: 60000 });
console.log('clone shot saved');
await page.goto(`https://gopenguin.lol/?room=${room}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(10000);
await page.screenshot({ path: path.join(__dirname, 'shots', `ref-${room}.png`), timeout: 60000 });
console.log('ref shot saved');
await browser.close();
