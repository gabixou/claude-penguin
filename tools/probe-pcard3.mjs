import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 200; i++) {
  const ok = await p.evaluate(() => {
    const sc = window.__penguin?.scene;
    return !!(sc && sc._movieReady && sc.localPlayer?.view);
  }).catch(() => false);
  if (ok) break;
  await p.waitForTimeout(1000);
}
// abre o card direto (sem clique) para inspecionar
await p.evaluate(() => window.__penguin.scene.playerCard.open(window.__penguin.scene.localPlayer));
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(1000);
  const st = await p.evaluate(() => {
    const sc = window.__penguin.scene;
    const c = sc.playerCard?.container;
    if (!c) return { open: false };
    // conta filhos e verifica pixels do canvas da janela
    let painted = 0;
    for (const ch of c.list) {
      if (ch.type === 'Image' && ch.texture) {
        const src = ch.texture.getSourceImage();
        if (src && src.width > 10) {
          const cc = document.createElement('canvas');
          cc.width = Math.min(src.width, 64); cc.height = Math.min(src.height, 64);
          const cx = cc.getContext('2d');
          cx.drawImage(src, 0, 0, cc.width, cc.height);
          const d = cx.getImageData(0, 0, cc.width, cc.height).data;
          for (let j = 3; j < d.length; j += 4) if (d[j] > 10) painted++;
        }
      }
    }
    return { open: true, children: c.list.length, painted };
  }).catch((e) => ({ err: String(e).slice(0, 120) }));
  if (st.open && st.painted > 100) { console.log('OK', JSON.stringify(st), 'em', i + 1, 's'); break; }
  if (i === 39) console.log('final', JSON.stringify(st));
}
await p.screenshot({ path: 'shots/pc-test2.png' });
await b.close();
