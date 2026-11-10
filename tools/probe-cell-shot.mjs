import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => window.__penguin.scene.toggleClothes());
await p.waitForTimeout(30000);
await p.waitForFunction(() => {
  const w = window.__penguin.scene.wardrobe;
  return w?.cells?.every(c => c.list.some(k => k.type === 'Image'));
}, null, { timeout: 30000 }).catch(() => {});
// pega bounds do primeiro ícone em coords de tela
const info = await p.evaluate(() => {
  const s = window.__penguin.scene;
  const w = s.wardrobe;
  const cell = w.cells[0];
  const img = cell.list.find(k => k.type === 'Image');
  const bounds = img.getBounds();
  const canvas = s.game.canvas;
  const rect = canvas.getBoundingClientRect();
  // converte world coords para screen coords
  const sx = rect.x + bounds.x * (rect.width / 760);
  const sy = rect.y + bounds.y * (rect.height / 480);
  const sw = bounds.width * (rect.width / 760);
  const sh = bounds.height * (rect.height / 480);
  return { sx, sy, sw, sh };
});
console.log(JSON.stringify(info));
// crop com margem
const pad = 20;
await p.screenshot({ path: 'tools/shots/icon-cell.png', clip: {
  x: Math.max(0, info.sx - pad), y: Math.max(0, info.sy - pad),
  width: info.sw + pad*2, height: info.sh + pad*2
}});
await b.close();
