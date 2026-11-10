import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\GABS\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('https://gopenguin.lol/?room=shop', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(15000);
await p.evaluate(() => window.penguinUI.openCatalogue('clothing'));
await p.waitForTimeout(6000);
const state = async (tag) => {
  const r = await p.evaluate(() => {
    const c = window.penguinPanels?.current;
    const mv = c?.spec?.movie;
    return {
      frame: mv?.currentFrame ? mv.currentFrame('book') : mv?.state?.get?.('book')?.frame,
      controls: (c?.spec?.controls || []).map(x => x.label).slice(0, 20),
      hits: (c?.hits || []).map(x => x.label || x.id).slice(0, 20),
    };
  });
  console.log(tag, JSON.stringify(r));
  await p.screenshot({ path: `shots/refcat-${tag}.png` });
};
await state('p0');
// clica no lado direito do livro (proxima pagina)
for (let i = 1; i <= 4; i++) {
  await p.mouse.click(900, 400);
  await p.waitForTimeout(1500);
  await state('p' + i);
}
await b.close();
