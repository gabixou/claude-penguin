// dbg-hover5.mjs <url> — estado de overlays que podem bloquear hoverAt
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1520, height: 960 } });
await p.goto(url, { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__penguin?.scene?._movieReady === true, { timeout: 120000 }); } catch {}
await p.waitForTimeout(3000);
const st = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  return {
    catalogue: s.catalogue ? { isOpen: s.catalogue.isOpen, promptOpen: !!s.catalogue.promptOpen } : null,
    mapOpen: s.mapOpen, clothesOpen: s.clothesOpen,
    wardrobe: !!s.wardrobe?.isOpen, playerCard: !!s.playerCard?.isOpen,
    minigame: !!s._minigameOpen,
    dimAlpha: s._dimOverlay?.alpha, dimVisible: s._dimOverlay?.visible,
    interactions: !!s._interactions, nButtons: s._interactions?.buttons?.length,
  };
});
console.log(JSON.stringify(st, null, 1));
// hover real via mouse na posicao certa
const btn = await p.evaluate(() => {
  const s = window.__penguin?.scene;
  const b2 = s?._interactions?.buttons?.find((x) => /dance_btn/.test(x.path));
  return b2 ? { cx: (b2.bounds[0] + b2.bounds[2]) / 2, cy: (b2.bounds[1] + b2.bounds[3]) / 2 } : null;
});
if (btn) {
  await p.mouse.move(btn.cx * 2.25, btn.cy * 2.25, { steps: 3 });
  await p.waitForTimeout(800);
  const h = await p.evaluate(() => ({
    hovered: window.__penguin.scene._interactions?.hovered,
    pw: window.__penguin.scene._pointerWorld,
  }));
  console.log('apos mouse real:', JSON.stringify(h));
}
await b.close();
