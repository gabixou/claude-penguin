import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const p = await b.newPage();
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.type(), m.text().slice(0, 200)); });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__penguin && window.__penguin.view, null, { timeout: 90000 });
await p.waitForTimeout(8000);
const info = await p.evaluate(async () => {
  const out = { items: [...window.__penguin.view.items.keys()] };
  // tenta carregar manualmente
  try {
    const mod = await import('/src/movie/movie.js');
    const mv = await mod.MovieRoom.load('/assets/clothing/221');
    out.manual = { ok: true, frames: mv.data?.main?.frames?.length, files: mv.files?.size, packs: mv.packs?.length };
  } catch (e) { out.manual = { err: String(e && e.message || e) }; }
  return out;
});
console.log(JSON.stringify(info));
await b.close();
