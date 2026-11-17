// Bake offline: rasteriza os SVGs dos packs movie para PNG atlases.
// Saida por movie: chars/atlas-N.png + chars/atlas.json
//   atlas.json = { v:1, k:<scale>, sheets:["atlas-0.png",...],
//                  frames:{ "<file>": {s,x,y,w,h} } }
// Uso:
//   node tools/bake-char-atlas.mjs [--k 5] [--force] [--only <substr>] <dir...>
//   dirs = raizes contendo movies (ex.: client/public/assets/movies/penguin-actions)
//         ou o proprio assets/ (varre ate depth 2 procurando timelines.json)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const K = parseFloat(opt('k', '5'));
const FORCE = args.includes('--force');
const ONLY = opt('only', '');
const DIRS = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--k' && args[i - 1] !== '--only');
if (!DIRS.length) { console.error('informe dirs'); process.exit(1); }

const SHEET = 4096;

// ---- Node: descobre movies e extrai SVGs ----
function* walkMovies(dir, depth = 0) {
  if (depth > 3) return;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  if (ents.some((e) => e.name === 'timelines.json')) { yield dir; return; }
  for (const e of ents) if (e.isDirectory()) yield* walkMovies(path.join(dir, e.name), depth + 1);
}

function packIndex(tl, dir) {
  const files = new Map(); // file -> {pack, off, len}
  const packPaths = new Map(); // packName -> abs path
  if (tl.pack?.file) {
    packPaths.set(tl.pack.file, path.join(dir, 'chars', tl.pack.file));
    for (const [f, e] of Object.entries(tl.pack.entries || {})) files.set(f, { pack: tl.pack.file, off: e[0], len: e[1] });
  }
  const cf = tl.chunks?.files || [];
  for (const f of cf) packPaths.set(f, path.join(dir, 'chars', f));
  for (const [f, e] of Object.entries(tl.chunks?.entries || {})) {
    if (e.length === 3) files.set(f, { pack: cf[e[0]], off: e[1], len: e[2] });
    else files.set(f, { pack: cf[0] ?? tl.pack?.file, off: e[0], len: e[1] });
  }
  return { files, packPaths };
}

function extractItems(dir) {
  const tlPath = path.join(dir, 'timelines.json');
  const tl = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
  const { files, packPaths } = packIndex(tl, dir);
  const packs = new Map();
  const getPack = (name) => {
    if (!packs.has(name)) {
      const p = packPaths.get(name);
      packs.set(name, p && fs.existsSync(p) ? fs.readFileSync(p) : null);
    }
    return packs.get(name);
  };
  const seen = new Map(); // dedupe por conteudo
  const aliases = []; // [aliasFile, canonicalFile]
  const items = [];
  for (const c of Object.values(tl.characters || {})) {
    const f = c?.file;
    if (!f || seen.has(f)) continue;
    const e = files.get(f);
    if (!e) continue;
    const buf = getPack(e.pack);
    if (!buf) continue;
    const svg = buf.subarray(e.off, e.off + e.len).toString('utf8');
    if (!svg.includes('<svg')) continue;
    let [w, h] = c.size || [];
    if (!w || !h) {
      const m = svg.match(/<svg[^>]*width="([\d.]+)[^"]*"[^>]*height="([\d.]+)[^"]*"/) || svg.match(/width="([\d.]+)"[^>]*height="([\d.]+)"/);
      if (m) { w = +m[1]; h = +m[2]; }
    }
    if (!w || !h) continue;
    const hsh = crypto.createHash('sha1').update(svg).digest('hex');
    if (seen.has(hsh)) { aliases.push([f, seen.get(hsh)]); continue; }
    seen.set(hsh, f);
    items.push({ file: f, w, h, svg });
  }
  return { items, aliases, tl };
}

// ---- Browser: pack + raster ----
// ---- main ----
const movies = [];
for (const d of DIRS) for (const m of walkMovies(path.resolve(ROOT, d))) {
  if (ONLY && !m.replace(/\\/g, '/').includes(ONLY)) continue;
  movies.push(m);
}
console.log(`${movies.length} movies para bake (K=${K})`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.exposeFunction('__bakeSave', async (name, b64) => {
  // gravado pelo Node via callback abaixo — expomos p/ promise
  return globalThis.__bakeSave(name, b64);
});
let saveTarget = null;
globalThis.__bakeSave = async (name, b64) => {
  fs.writeFileSync(path.join(saveTarget, name), Buffer.from(b64, 'base64'));
};
await page.goto('about:blank');

let done = 0, failed = 0, totalChars = 0;
const t0 = Date.now();
for (const m of movies) {
  const outDir = path.join(m, 'chars');
  const atlasJson = path.join(outDir, 'atlas.json');
  if (!FORCE && fs.existsSync(atlasJson)) { done++; continue; }
  let items, aliases;
  try { ({ items, aliases } = extractItems(m)); } catch (e) { console.log('SKIP', m, e.message); failed++; continue; }
  if (!items.length) { done++; continue; }
  saveTarget = outDir;
  fs.mkdirSync(outDir, { recursive: true });
  // envia items em chunks p/ window._items
  await page.evaluate(() => { window._items = []; });
  for (let i = 0; i < items.length; i += 400) {
    const slice = items.slice(i, i + 400).map(({ file, w, h, svg }) => ({ file, w, h, svg }));
    await page.evaluate((s) => window._items.push(...s), slice);
  }
  let res;
  try {
    res = await page.evaluate(async ({ K, SHEET }) => {
      const items = window._items;
      window._items = [];
      const M = 2;
      const sorted = items
        .map((it) => ({ ...it, W: Math.ceil(it.w * K) + M, H: Math.ceil(it.h * K) + M }))
        .sort((a, b) => b.H - a.H || b.W - a.W);
      const frames = {};
      let sheetIdx = -1, cv = null, ctx = null, cx = 0, cy = 0, rowH = 0;
      const open = () => {
        sheetIdx++;
        cv = document.createElement('canvas'); cv.width = cv.height = SHEET;
        ctx = cv.getContext('2d'); cx = cy = M; rowH = 0;
      };
      const flush = async () => {
        if (!cv) return;
        const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
        await window.__bakeSave('atlas-' + sheetIdx + '.png', b64);
      };
      open();
      for (const it of sorted) {
        if (cx + it.W > SHEET) { cx = M; cy += rowH; rowH = 0; }
        if (cy + it.H > SHEET) { await flush(); open(); }
        const dw = Math.ceil(it.w * K), dh = Math.ceil(it.h * K);
        const img = new Image();
        const ok = await new Promise((res2) => {
          img.onload = () => res2(true); img.onerror = () => res2(false);
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg);
        });
        if (!ok) continue;
        ctx.drawImage(img, cx, cy, dw, dh);
        frames[it.file] = { s: sheetIdx, x: cx, y: cy, w: dw, h: dh };
        cx += it.W; rowH = Math.max(rowH, it.H);
      }
      await flush();
      return { frames, sheets: sheetIdx + 1 };
    }, { K, SHEET });
  } catch (e) {
    console.log('FAIL', path.relative(ROOT, m), e.message);
    failed++; continue;
  }
  for (const [a, c] of aliases || []) if (res.frames[c]) res.frames[a] = res.frames[c];
  fs.writeFileSync(atlasJson, JSON.stringify({ v: 1, k: K, sheets: Array.from({ length: res.sheets }, (_, i) => 'atlas-' + i + '.png'), frames: res.frames }));
  done++; totalChars += items.length;
  if (done % 25 === 0) console.log(`${done}/${movies.length} movies, ${totalChars} chars, ${((Date.now() - t0) / 60000).toFixed(1)}min`);
}
await browser.close();
console.log(`FIM: ${done} ok, ${failed} falhas, ${totalChars} chars, ${((Date.now() - t0) / 60000).toFixed(1)}min`);
