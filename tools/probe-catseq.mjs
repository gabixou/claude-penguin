import { chromium } from 'playwright-core';
const cat = process.argv[2] || 'clothing';
const frames = (process.argv[3] || '3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20').split(',').map(Number);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__penguin?.scene?._movieReady, null, { timeout: 240000 });
await p.evaluate((c) => window.__penguin.scene.openContent(c + '_catalogue'), cat);
await p.waitForTimeout(4000);
const r = await p.evaluate(async ({ cat, frames }) => {
  const scene = window.__penguin.scene;
  const MovieRoom = scene.catalogue.movie.constructor;
  const shot = async (m, f) => {
    const c = document.createElement('canvas'); c.width = 760; c.height = 480;
    await m.renderFrame(f - 1, c, 1);
    return c.toDataURL('image/png');
  };
  // sequencial: mesmo MovieRoom percorrendo as paginas (como o goto real)
  const mSeq = await MovieRoom.load('/assets/catalogues/' + cat);
  const seq = [];
  for (const f of frames) { mSeq.goto('book', f); seq.push(await shot(mSeq, f)); }
  // isolado: MovieRoom novo por pagina (referencia "correta")
  const iso = [];
  for (const f of frames) {
    const m = await MovieRoom.load('/assets/catalogues/' + cat);
    m.goto('book', f);
    iso.push(await shot(m, f));
  }
  return { seq, iso };
}, { cat, frames });
let bad = 0;
for (let i = 0; i < frames.length; i++) {
  const same = r.seq[i] === r.iso[i];
  if (!same) bad++;
  console.log(`frame ${frames[i]}: ${same ? 'OK' : 'DIFERE do isolado'}`);
}
console.log(bad ? `${bad} pagina(s) com arte vazada` : 'todas as paginas identicas ao render isolado');
console.log('pageerrors:', errs.length ? errs.slice(0, 3) : 'zero');
await b.close();
