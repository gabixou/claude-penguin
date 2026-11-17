// analisa regiao do photo_mc no screenshot do card
import { chromium } from 'playwright-core';
import fs from 'fs';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);
await p.evaluate(() => { window.__penguin.scene.playerCard?.open(window.__penguin.scene.localPlayer); });
await p.waitForTimeout(4000);
// bounds do photo_mc no canvas do card -> converte p/ screen e corta
const r = await p.evaluate(() => {
  const scene = window.__penguin.scene;
  const cont = scene.playerCard.container;
  const img = cont?.list?.find(o => o.texture?.key?.startsWith('playercard_'));
  if (!img) return null;
  // photo_mc em sprite coords ~(8,40)-(~200,140)? pega via canvas: regiao superior do card
  const bounds = img.getBounds();
  return { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height };
});
console.log('card bounds:', JSON.stringify(r));
// corta regiao do photo (topo do card ~15-45% altura)
const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h * 0.35) };
await p.screenshot({ path: 'tools/shots/card-photo.png', clip });
console.log('saved tools/shots/card-photo.png');
await b.close();
