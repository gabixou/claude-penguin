// Probe: hover na porta do nightclub — gp vs localhost
// uso: node probe-disco-hover.mjs gp|ours
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const target = process.argv[2] || 'ours';
const url = target === 'gp' ? 'https://gopenguin.lol/?room=town' : 'http://localhost:3000/?penguin=Arenovisk';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
// espera o jogo carregar
if (target === 'ours') {
  await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, null, { timeout: 240000 });
} else {
  await p.waitForTimeout(12000);
}
await p.waitForTimeout(3000);

// descobre o rect do botao dance_btn na tela
const rect = await p.evaluate(() => {
  // nosso cliente expoe os botoes? tenta via scene
  const sc = window.__penguin?.scene;
  if (sc?._interactions?.buttons) {
    for (const [path, btn] of Object.entries(sc._interactions.buttons)) {
      if (path.includes('dance_btn')) return { path, ...btn };
    }
  }
  return null;
});
console.log('button info:', JSON.stringify(rect));

// fallback: coordenada conhecida do walk target (342,205) mundo -> tela
// stage 760x480 em canvas 1024x768 -> scale 1.347, sem offset (4:3 exato)
const door = rect?.rect ? {
  x: (rect.rect.x + rect.rect.w / 2) * (1024 / 760),
  y: (rect.rect.y + rect.rect.h / 2) * (1024 / 760),
} : { x: 342 * (1024 / 760), y: 205 * (1024 / 760) };
// se o canvas nao for full-viewport, calcula offset real do canvas
const canvasBox = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('canvas:', JSON.stringify(canvasBox));
// converte world->screen usando o retangulo real do canvas
const scale = Math.min(canvasBox.w / 760, canvasBox.h / 480);
const offX = canvasBox.x + (canvasBox.w - 760 * scale) / 2;
const offY = canvasBox.y + (canvasBox.h - 480 * scale) / 2;
const wx = rect?.rect ? rect.rect.x + rect.rect.w / 2 : 342;
const wy = rect?.rect ? rect.rect.y + rect.rect.h / 2 : 205;
const sx = offX + wx * scale, sy = offY + wy * scale;
console.log('hover at screen', sx, sy, '(world', wx, wy + ')');

await p.screenshot({ path: `shots/disco-${target}-idle.png` });
await p.mouse.move(sx, sy, { steps: 5 });
await p.waitForTimeout(1200);
await p.screenshot({ path: `shots/disco-${target}-hover.png` });
await p.waitForTimeout(1500);
await p.screenshot({ path: `shots/disco-${target}-hover2.png` });
await p.mouse.move(sx - 300, sy + 200, { steps: 8 });
await p.waitForTimeout(1200);
await p.screenshot({ path: `shots/disco-${target}-out.png` });
await b.close();
console.log('done', target);
