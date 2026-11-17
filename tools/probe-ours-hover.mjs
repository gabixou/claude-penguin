import { chromium } from 'playwright-core';
const TOKEN = '27249d7256bd47b3cb685bed60cfc5f1cfe02b9c75f85eb677e248fba0359442';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await p.evaluate((t) => localStorage.setItem('penguin_session', t), TOKEN);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.waitForTimeout(2000);
const r = await p.evaluate(async () => {
  const scene = window.__penguin.scene;
  const m = scene.movie;
  const out = { hoverPath: null, btns: [] };
  // lista botoes perto da porta dance
  for (const btn of m.findButtons()) {
    if (/dance|nightclub/i.test(btn.path)) out.btns.push({ path: btn.path, bounds: btn.bounds.map(v => Math.round(v)) });
  }
  // hover na porta (walk target 342,205)
  scene._interactions.hoverAt(342, 205);
  await new Promise(r => setTimeout(r, 300));
  out.hoverPath = scene._interactions.hovered;
  out.btnState = m._buttonStates.get('background_mc.dance_btn_states.dance_btn');
  // playhead do sprite 88 (estrelas) dentro do botao
  for (const [k, v] of m._playheads) if (k.includes('dance_btn')) out['ph_' + k] = v.frame;
  // espera animacao e le de novo
  await new Promise(r => setTimeout(r, 1000));
  out.phAfter = {};
  for (const [k, v] of m._playheads) if (k.includes('dance_btn') || k.includes('#88')) out.phAfter[k] = v.frame;
  return out;
});
console.log(JSON.stringify(r, null, 1));
await p.screenshot({ path: 'shots/ours-town-hover.png' });
await b.close();
