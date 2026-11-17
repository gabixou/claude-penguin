// Captura screenshots durante a animacao de cuidado do puffle equipado
// (z-index issue #14). Uso: node tools/qa-capture-depth.mjs  (cwd=tools/)
import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = '../tools/shots';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1038, height: 607 } })).newPage();
page.setDefaultTimeout(30000);
await page.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__penguin?.scene?._playerReady, null, { timeout: 45000 });
await page.waitForTimeout(2000);

await page.evaluate(async () => {
  const s = window.__penguin.scene;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pets = s.network?.social?.pets || [];
  const eq = pets.find(p => p.equipped) || pets[0];
  if (eq && !pets.find(p => p.equipped)) { s.network.petEquip(eq.petRowId); await sleep(1500); }
  let v = null;
  for (let i = 0; i < 60; i++) { await sleep(300); v = [...(s.petViews?.values() || [])].find(x => x.pet?.petRowId === eq.petRowId); if (v?._ready) break; }
  if (v) { window.__pv = v; s.network.petCare(v.pet.petRowId, 'play'); }
});

for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => {
    const v = window.__pv; if (!v) return null;
    return { care: !!v._care, d: +v.container.depth.toFixed(2), px: Math.round(v.x), py: Math.round(v.y) };
  });
  await page.screenshot({ path: `${OUT}/depth-${String(i).padStart(2, '0')}.png` });
  console.log(i, JSON.stringify(st));
  if (st && !st.care && i > 3) break;
}
await browser.close();
