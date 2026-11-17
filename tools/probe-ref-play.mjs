import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const t0 = Date.now();
await p.goto('https://gopenguin.lol/', { waitUntil: 'domcontentloaded', timeout: 60000 });
// clica Skip do onboarding assim que aparecer
for (let i = 0; i < 60; i++) {
  const clicked = await p.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, div, span')];
    const el = els.find(e => e.innerText?.trim() === 'Skip' || e.innerText?.trim() === 'Play');
    if (el) { el.click(); return el.innerText.trim(); }
    return null;
  }).catch(() => null);
  if (clicked) { console.log('CLICKED', clicked, 'at', ((Date.now() - t0) / 1000).toFixed(1) + 's'); break; }
  await p.waitForTimeout(500);
}
await p.waitForTimeout(3000);
// FPS por 4s
const fps = await p.evaluate(() => new Promise((res) => {
  const deltas = []; let last = performance.now();
  const loop = (t) => { deltas.push(t - last); last = t;
    if (deltas.length < 240) requestAnimationFrame(loop);
    else { deltas.sort((a,b)=>a-b); const avg = deltas.reduce((a,b)=>a+b,0)/deltas.length;
      res({ avgMs:+avg.toFixed(2), p95:+deltas[Math.floor(deltas.length*0.95)].toFixed(1), fps:+(1000/avg).toFixed(1) }); } };
  requestAnimationFrame(loop);
}));
console.log('FPS idle', JSON.stringify(fps));
// tenta simular movimento: clique no centro da tela (click-to-move)
await p.mouse.click(640, 400);
await p.waitForTimeout(1500);
const fps2 = await p.evaluate(() => new Promise((res) => {
  const deltas = []; let last = performance.now();
  const loop = (t) => { deltas.push(t - last); last = t;
    if (deltas.length < 240) requestAnimationFrame(loop);
    else { deltas.sort((a,b)=>a-b); const avg = deltas.reduce((a,b)=>a+b,0)/deltas.length;
      res({ avgMs:+avg.toFixed(2), p95:+deltas[Math.floor(deltas.length*0.95)].toFixed(1), fps:+(1000/avg).toFixed(1) }); } };
  requestAnimationFrame(loop);
}));
console.log('FPS after click', JSON.stringify(fps2));
const st = await p.evaluate(() => ({ text: document.body?.innerText?.slice(0, 200) }));
console.log('STATE', JSON.stringify(st));
await b.screenshot({ path: 'shots/ref-gp-game.png' });
await b.close();
