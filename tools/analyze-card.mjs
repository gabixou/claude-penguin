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
  scene.playerCard?.open(scene.localPlayer);
  await new Promise(r => setTimeout(r, 4000));
  // pega o canvas do card e conta pixels nao-transparentes/coloridos por regiao
  const cont = scene.playerCard.container;
  const img = cont?.list?.find(o => o.texture?.key?.startsWith('playercard_'));
  if (!img) return { err: 'no card image' };
  const tex = img.texture.getSourceImage();
  const c = document.createElement('canvas');
  c.width = tex.width; c.height = tex.height;
  const cx = c.getContext('2d');
  cx.drawImage(tex, 0, 0);
  const d = cx.getImageData(0, 0, c.width, c.height).data;
  // regiao do photo_mc: terco superior do card; flag: canto superior direito
  const stats = (x0,y0,x1,y1) => {
    let n=0, colors=new Set();
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const i=(y*c.width+x)*4;
      if(d[i+3]>100){n++;colors.add((d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4));}
    }
    return {n, colors:colors.size};
  };
  const W=c.width,H=c.height;
  return {
    size:[W,H],
    top: stats(0,0,W,Math.floor(H*0.3)),
    mid: stats(0,Math.floor(H*0.3),W,Math.floor(H*0.7)),
    corner: stats(Math.floor(W*0.7),0,W,Math.floor(H*0.25)),
    outfit: scene.localPlayer.gpaOutfit,
  };
});
console.log(JSON.stringify(r));
await b.close();
