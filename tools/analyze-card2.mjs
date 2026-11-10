import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const lp = scene.localPlayer;
  scene.playerCard?.open(lp);
  await new Promise(r => setTimeout(r, 4000));
  const grab = () => {
    const cont = scene.playerCard.container;
    const img = cont?.list?.find(o => o.texture?.key?.startsWith('playercard_'));
    const tex = img.texture.getSourceImage();
    const c = document.createElement('canvas'); c.width = tex.width; c.height = tex.height;
    const cx = c.getContext('2d'); cx.drawImage(tex, 0, 0);
    return cx.getImageData(0, 0, c.width, c.height).data;
  };
  const withItems = grab();
  // remove photo+flag e repinta
  const saved = { ...lp.gpaOutfit };
  lp.gpaOutfit.photo = null; lp.gpaOutfit.flag = null;
  await scene.playerCard._repaint();
  await new Promise(r => setTimeout(r, 1500));
  const without = grab();
  lp.gpaOutfit = saved;
  await scene.playerCard._repaint();
  // conta pixels diferentes
  let diff = 0, total = withItems.length / 4;
  for (let i = 0; i < withItems.length; i += 4) {
    if (Math.abs(withItems[i]-without[i])>20 || Math.abs(withItems[i+1]-without[i+1])>20 || Math.abs(withItems[i+2]-without[i+2])>20) diff++;
  }
  return { diffPx: diff, totalPx: total, pct: (diff/total*100).toFixed(2) };
});
console.log(JSON.stringify(r));
await b.close();
