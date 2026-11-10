import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); // contexto novo = IDB vazio = cold load
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

const samples = [];
let violations = [];
for (let i = 0; i < 250; i++) {
  await p.waitForTimeout(80);
  const st = await p.evaluate(() => {
    const s = window.__penguin?.scene;
    if (!s) return null;
    const layers = s.movieLayers || [];
    return {
      t: Math.round(performance.now()),
      loader: !!s.loadingScreen?.visible,
      ready: !!s._movieReady,
      playerReady: !!s._playerReady,
      vis: layers.filter(l => l.img?.visible).length,
      total: layers.length,
      room: s.currentRoom,
    };
  }).catch(() => null);
  if (!st) continue;
  samples.push(st);
  // violacao: layer visivel antes do movie pronto, ou layer visivel com loader ainda na tela
  if ((st.vis > 0 && !st.ready) || (st.vis > 0 && st.loader)) {
    violations.push(st);
  }
  if (st.ready && st.vis === st.total && st.total > 0) {
    // espera mais um pouco para ver se algo muda depois do reveal
    await p.waitForTimeout(500);
    const post = await p.evaluate(() => {
      const s = window.__penguin?.scene;
      const layers = s.movieLayers || [];
      return { loader: !!s.loadingScreen?.visible, ready: !!s._movieReady,
               vis: layers.filter(l => l.img?.visible).length, total: layers.length,
               penguin: !!s.localPlayer, remotes: s.remotePlayers?.size };
    });
    console.log('REVEAL+500ms', JSON.stringify(post));
    break;
  }
}

// resumo: transicoes
let last = null;
for (const s of samples) {
  const key = `${s.loader}|${s.ready}|${s.vis}/${s.total}|p${s.playerReady}`;
  if (key !== last) { console.log(`t=${s.t} loader=${s.loader} ready=${s.ready} layers=${s.vis}/${s.total} player=${s.playerReady} room=${s.room}`); last = key; }
}
console.log('VIOLATIONS:', violations.length, violations.slice(0, 5));
console.log('ERRORS:', errors.slice(0, 5));
await b.close();
