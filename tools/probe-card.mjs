import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('PAGEERR', String(e)));
await p.goto('http://localhost:3000/?penguin=Arenovisk', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForFunction(() => {
  const sc = window.__penguin.scene;
  return sc.movie && sc._movieReady && (!sc.loadingScreen || !sc.loadingScreen.visible);
}, null, { timeout: 180000 });
await p.waitForTimeout(1500);

// abre o player card do jogador local
await p.evaluate(() => { window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer); });
await p.waitForTimeout(2500); // photos/ papers carregam async
await p.screenshot({ path: 'shots/card-photo.png' });

// mede: a foto esta clipada? amostra pixels na area do badge (30,30 card coords)
// e verifica se o canvas do card tem conteudo fora da janela da foto
const r = await p.evaluate(() => {
  const sc = window.__penguin.scene;
  const pc = sc.playerCard;
  return { open: pc.isOpen, outfit: window.__penguin.gpaOutfit };
});
console.log(JSON.stringify(r));
await b.close();
