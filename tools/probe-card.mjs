import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);

const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const pc = scene.playerCard;
  const out = {};
  const cardContainers = () => scene.children.list.filter(o => o.type === 'Container' && o.depth === 20000000).length;
  const texCount = () => Object.keys(scene.textures.list).filter(k => k.startsWith('playercard_')).length;

  // 1) multiplos open() rapidos no mesmo pinguim -> 1 card so
  pc.open(scene.localPlayer); pc.open(scene.localPlayer); pc.open(scene.localPlayer);
  await new Promise(r => setTimeout(r, 1500));
  out.tripleOpen = { containers: cardContainers(), textures: texCount(), isOpen: pc.isOpen };

  // 2) tecla 'i' com card aberto -> wardrobe abre, card continua
  scene.handleAction('clothes');
  await new Promise(r => setTimeout(r, 800));
  out.iWithCard = { card: pc.isOpen, wardrobe: !!scene.wardrobe?.isOpen };
  scene.wardrobe?.close?.();

  // 3) fecha card, tecla 'i' -> NADA deve abrir
  pc.close();
  await new Promise(r => setTimeout(r, 300));
  scene.handleAction('clothes');
  await new Promise(r => setTimeout(r, 800));
  out.iNoCard = { card: pc.isOpen, wardrobe: !!scene.wardrobe?.isOpen, clothesOpen: scene.clothesOpen };

  // 4) abre card de novo e clica no proprio pinguim (simula dim->penguin) -> mantem 1 card
  await pc.open(scene.localPlayer);
  await new Promise(r => setTimeout(r, 1200));
  const before = cardContainers();
  // simula o handler do dim com um pinguim
  pc.dim.emit('pointerdown', { worldX: scene.localPlayer.x, worldY: scene.localPlayer.y });
  await new Promise(r => setTimeout(r, 1200));
  out.clickPenguinWhileOpen = { before, after: cardContainers(), isOpen: pc.isOpen, textures: texCount() };

  // 5) clique fora (sem pinguim) -> fecha
  pc.dim.emit('pointerdown', { worldX: 10, worldY: 10 });
  await new Promise(r => setTimeout(r, 500));
  out.clickOutside = { isOpen: pc.isOpen, containers: cardContainers(), textures: texCount() };

  return out;
});
console.log(JSON.stringify(r, null, 2));
console.log('pageerrors:', errors.length ? errors : 'none');
await b.close();
