import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  // carrega movies via os loaders internos do PlayerCard (acessa via closure? nao).
  // Usar MovieRoom do playerCard._movie() e assetMovie implicito: fetch timelines direto
  const tl = await fetch('/assets/photos/9063/timelines.json').then(r=>r.json());
  // renderiza via MovieRoom carregado pelo playerCard para photos? photoMovie e privado.
  // hack: instancia MovieRoom pela classe do movie do card
  const movie = await scene.playerCard._movie();
  const MovieRoom = movie.constructor;
  const pm = await MovieRoom.load('/assets/photos/9063');
  const c = document.createElement('canvas'); c.width=400; c.height=300;
  await pm.renderFrame(0, c, 3);
  const cx = c.getContext('2d');
  const d = cx.getImageData(0,0,c.width,c.height).data;
  let n=0; const colors=new Set();
  for(let i=0;i<d.length;i+=16){ if(d[i+3]>100){n++;colors.add((d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4));}}
  return {stage: pm.stage, samples:n, unique:colors.size, top:[...colors].slice(0,10)};
});
console.log(JSON.stringify(r));
await b.close();
