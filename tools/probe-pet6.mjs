import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate(() => { window.__penguin.scene.changeRoom('pet'); });
await p.waitForFunction(() => window.__penguin.scene?._movieReady && window.__penguin.scene.currentRoom === 'pet', null, { timeout: 240000 });
await new Promise(r => setTimeout(r, 1500));

const readW = () => p.evaluate(() => { const w = window.__penguin.scene._pointerWorld; return w ? [w.x, w.y] : null; });

// calibra o mapa mundo->css com 2 amostras (transformacao afim linear)
await p.mouse.move(400, 300); await p.waitForTimeout(150);
const w1 = await readW();
await p.mouse.move(700, 500); await p.waitForTimeout(150);
const w2 = await readW();
console.log('calib', JSON.stringify({ w1, w2 }));
// css = M * world + t  =>  resolve para world->css usando amostras css conhecidas
// temos: css1=(400,300)->w1, css2=(700,500)->w2  (css->world afim)
// invertemos: world->css
const [a, b2, c, d] = [0,0,0,0];
// css->world: wx = A*sx + B*sy + C ; wy = D*sx + E*sy + F
const det = (400-700)*(300-500) - (300-500)*(400-700); // nao usado; resolve direto 2x2 por eixo
// por eixo: wx = A*sx+B*sy+C ; wy = D*sx+E*sy+F  (sem rotacao: B=E=0 provavelmente)
const Ax = (w1[0]-w2[0])/(400-700), Bx = 0, Cx = w1[0]-Ax*400;
const Ay = 0, Ey = (w1[1]-w2[1])/(300-500), Fy = w1[1]-Ey*300;
// world->css: sx = (wx-Cx)/Ax ; sy=(wy-Fy)/Ey
const sx = (690-Cx)/Ax, sy = (245-Fy)/Ey;
console.log('target css', sx, sy, 'check world->', Ax*sx+Cx, Ey*sy+Fy);
await p.mouse.move(sx, sy); await p.waitForTimeout(150);
const wpt = await readW();
console.log('FINAL WORLD:', JSON.stringify(wpt));
await p.mouse.down(); await p.mouse.up();
await p.waitForTimeout(5000);
const st = await p.evaluate(() => {
  const s = window.__penguin.scene;
  return { room: s.currentRoom, pos: [s.localPlayer?.x, s.localPlayer?.y], iframe: !!document.querySelector('iframe[src*="pufflescape"]'), overlay: !!document.querySelector('div[style*="z-index: 10000"]') };
});
console.log('STATE:', JSON.stringify(st));
await p.screenshot({ path: 'shots/pet-puffle2.png' });
await p.evaluate(() => { const ov = [...document.querySelectorAll('div')].find(d => d.querySelector('iframe[src*="pufflescape"]')); ov?.querySelector('div[title]')?.click(); });
await p.waitForTimeout(400);
console.log('CLOSED:', await p.evaluate(() => !document.querySelector('iframe[src*="pufflescape"]')));
console.log('ERRS:', JSON.stringify(errs.slice(0, 5)));
await b.close();
