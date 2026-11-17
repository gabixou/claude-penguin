import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);
await p.screenshot({ path: 'shots/ours-town-idle.png' });
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const m = scene.movie;
  const out = {};
  scene._interactions.hoverAt(347, 170); // centro do botao dance [323,133,372,204]
  await new Promise(r => setTimeout(r, 400));
  out.hovered = scene._interactions.hovered;
  out.state = m._buttonStates.get('background_mc.dance_btn_states.dance_btn');
  // playheads que avancam?
  await new Promise(r => setTimeout(r, 1200));
  const adv = [];
  for (const [k, v] of m._playheads) if (v.frame > 1) adv.push(k + '=' + v.frame);
  out.advancing = adv.slice(0, 20);
  out.canopy = m._playheads.get('dance_canopy_mc')?.frame;
  // sprite 88 :: qual path?
  for (const k of m._playheads.keys()) if (k.includes('88') || k.includes('dance_btn')) out['k_' + k] = m._playheads.get(k).frame;
  return out;
});
console.log(JSON.stringify(r, null, 1));
await p.screenshot({ path: 'shots/ours-town-hover.png' });
await b.close();
