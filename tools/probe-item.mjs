import { chromium } from 'playwright-core';
const EXE = 'C:/Users/GABS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERROR:', String(e.stack||e).slice(0,400)));
await p.goto('http://localhost:3000/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);
const r = await p.evaluate(async () => {
  const lp = window.__penguin;
  const lib = await lp.scene.penguinLibrary;
  const out = { libOk: !!lib };
  try {
    const clipP = lib.itemClip(428);
    const clip = await clipP;
    out.clip = !!clip;
    if (clip) {
      out.frames = clip.data.main.frames.length;
      const inst = clip.instance();
      out.instFrames = inst.data.main.frames.length;
    }
  } catch (e) { out.err = String(e); }
  out.itemsNow = lp.view ? [...lp.view.items.keys()] : 'noview';
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
