import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Users/GABS/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe' });
const page = await browser.newPage({ viewport: { width: 800, height: 520 } });
page.on('console', m => console.log('C:', m.text().slice(0,150)));
page.on('pageerror', e => console.log('PE:', String(e).slice(0,200)));
await page.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e=>console.log('nav',e.message));
for (let i=0;i<6;i++){ await page.waitForTimeout(5000);
  const info = await page.evaluate(() => ({
    title: document.title,
    canvases: document.querySelectorAll('canvas').length,
    bodyText: document.body.innerText.slice(0,200),
    imgs: document.querySelectorAll('img').length
  }));
  console.log(i, JSON.stringify(info));
}
await page.screenshot({ path: 'E:/project/club-penguin-browser/tools/shots/ref-town.png' });
await browser.close();
