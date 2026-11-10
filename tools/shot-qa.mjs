import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const [cloneUrl, refUrl, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(cloneUrl, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(95000); // primeira visita rasteriza SVGs (lento em headless)
await p.screenshot({ path: out });
if (refUrl) {
  const p2 = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p2.goto(refUrl, { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(8000);
  await p2.screenshot({ path: out.replace('clone', 'ref') });
  await b.close();
} else await b.close();
console.log('done', out);
