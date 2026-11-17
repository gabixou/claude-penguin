import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const p = await ctx.newPage();
await p.goto('https://gopenguin.lol/?room=town', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(10000);
const r = await p.evaluate(() => {
  const out = {};
  for (const k of ['penguinWorld', 'penguinCamera', 'penguinRoom']) {
    const o = window[k];
    if (!o) { out[k] = null; continue; }
    out[k] = {};
    for (const key of Object.keys(o).slice(0, 40)) {
      const v = o[key];
      out[k][key] = typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v
        : (v && typeof v === 'object' ? (Array.isArray(v) ? 'arr[' + v.length + ']' : 'obj') : typeof v);
    }
  }
  // tenta achar scale/offset
  const w = window.penguinWorld, c = window.penguinCamera;
  out.sample = {
    worldKeys: w ? Object.keys(w) : null,
    camKeys: c ? Object.keys(c) : null,
  };
  return out;
});
console.log(JSON.stringify(r, null, 1).slice(0, 6000));
await b.close();
