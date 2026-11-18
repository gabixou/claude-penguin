// Corrige frames de atlas que estouraram a sheet no bake (chars maiores
// que --sheet): re-rasteriza SO esses SVGs em sheets grandes dedicadas
// (atlas-N.png continuando a numeracao) e atualiza atlas.json.
// Uso: node tools/atlas/fix-oversized-atlas.mjs [--sheet 2048] [--big 8192] [--only <substr>] <dir...>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SHEET = parseInt(opt('sheet', '2048'), 10);
const BIG_MAX = parseInt(opt('big', '8192'), 10);
const ONLY = opt('only', '');
const DIRS = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--sheet' && args[i - 1] !== '--big' && args[i - 1] !== '--only');
if (!DIRS.length) { console.error('informe dirs'); process.exit(1); }

function* walkMovies(dir, depth = 0) {
  if (depth > 3) return;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  if (ents.some((e) => e.name === 'timelines.json')) { yield dir; return; }
  for (const e of ents) if (e.isDirectory()) yield* walkMovies(path.join(dir, e.name), depth + 1);
}

function packIndex(tl, dir) {
  const files = new Map();
  const packPaths = new Map();
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
  const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timelines.json'), 'utf8'));
  const { files, packPaths } = packIndex(tl, dir);
  const packs = new Map();
  const getPack = (name) => {
    if (!packs.has(name)) {
      const p = packPaths.get(name);
      packs.set(name, p && fs.existsSync(p) ? fs.readFileSync(p) : null);
    }
    return packs.get(name);
  };
  const seen = new Map();
  const aliases = [];
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
  return { items, aliases };
}

function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(24);
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  return b.readUInt32BE(16);
}

const movies = [];
for (const d of DIRS) for (const m of walkMovies(path.resolve(ROOT, d))) {
  if (ONLY && !m.replace(/\\/g, '/').includes(ONLY)) continue;
  movies.push(m);
}
console.log(`${movies.length} movies para verificar`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.goto('about:blank');

let saveTarget = null;
globalThis.__bakeSave = async (name, b64) => {
  fs.writeFileSync(path.join(saveTarget, name), Buffer.from(b64, 'base64'));
};
await page.exposeFunction('__bakeSave', async (name, b64) => globalThis.__bakeSave(name, b64));

let fixed = 0, charsFixed = 0, skipped = 0, failedN = 0;
const t0 = Date.now();
for (const m of movies) {
  const outDir = path.join(m, 'chars');
  const atlasJson = path.join(outDir, 'atlas.json');
  if (!fs.existsSync(atlasJson)) { skipped++; continue; }
  const atlas = JSON.parse(fs.readFileSync(atlasJson, 'utf8'));
  const sheetDim = (atlas.sheets || []).map((s) => {
    const p = path.join(outDir, s);
    return fs.existsSync(p) ? pngSize(p) : SHEET;
  });
  const badFiles = new Set();
  for (const [f, fr] of Object.entries(atlas.frames || {})) {
    const dim = sheetDim[fr.s] ?? SHEET;
    if (fr.x + fr.w > dim || fr.y + fr.h > dim || fr.w > dim || fr.h > dim) badFiles.add(f);
  }
  if (!badFiles.size) { skipped++; continue; }

  let items, aliases;
  try { ({ items, aliases } = extractItems(m)); } catch { skipped++; continue; }
  const K = atlas.k || 5;
  const redo = items.filter((it) => badFiles.has(it.file));
  if (!redo.length) { skipped++; continue; }

  const M = 2;
  let big = 4096;
  const need = Math.max(...redo.map((it) => Math.max(Math.ceil(it.w * K) + M, Math.ceil(it.h * K) + M)));
  while (big < need && big < BIG_MAX) big *= 2;
  for (const it of redo) {
    it.kd = Math.min(K, (big - 2 * M) / Math.max(it.w, it.h));
    it.W = Math.ceil(it.w * it.kd) + M;
    it.H = Math.ceil(it.h * it.kd) + M;
  }
  redo.sort((a, b) => b.H - a.H || b.W - a.W);

  const startSheet = (atlas.sheets || []).length;
  saveTarget = outDir;
  let res;
  try {
    await page.evaluate(() => { window._items = []; window._sheetBase = 0; });
    for (let i = 0; i < redo.length; i += 400) {
      const slice = redo.slice(i, i + 400).map(({ file, w, h, svg, kd, W, H }) => ({ file, w, h, svg, kd, W, H }));
      await page.evaluate((s) => window._items.push(...s), slice);
    }
    res = await page.evaluate(async ({ BIG, M, base }) => {
      window._sheetBase = base;
      const items = window._items;
      window._items = [];
      const frames = {};
      let sheetIdx = -1, cv = null, ctx = null, cx = 0, cy = 0, rowH = 0, nSheets = 0;
      const open = () => {
        sheetIdx++;
        cv = document.createElement('canvas'); cv.width = cv.height = BIG;
        ctx = cv.getContext('2d'); cx = cy = M; rowH = 0;
      };
      const flush = async () => {
        if (!cv) return;
        const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
        const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
        await window.__bakeSave('atlas-' + (base + sheetIdx) + '.png', b64);
        nSheets++;
      };
      open();
      for (const it of items) {
        if (cx + it.W > BIG) { cx = M; cy += rowH; rowH = 0; }
        if (cy + it.H > BIG) { await flush(); open(); }
        const dw = Math.ceil(it.w * it.kd), dh = Math.ceil(it.h * it.kd);
        const img = new Image();
        const ok = await new Promise((r2) => {
          img.onload = () => r2(true); img.onerror = () => r2(false);
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg);
        });
        if (!ok) continue;
        ctx.drawImage(img, cx, cy, dw, dh);
        frames[it.file] = { s: base + sheetIdx, x: cx, y: cy, w: dw, h: dh };
        cx += it.W; rowH = Math.max(rowH, it.H);
      }
      await flush();
      return { frames, nSheets };
    }, { BIG: big, M, base: startSheet });
  } catch (e) {
    console.log('FAIL', path.relative(ROOT, m), e.message);
    failedN++; continue;
  }
  // atualiza frames: canonico refeito + aliases que apontam p/ ele
  const canonOf = new Map((aliases || []).map(([a, c]) => [a, c]));
  for (const [f] of Object.entries(atlas.frames)) {
    const canon = canonOf.get(f) || f;
    if (res.frames[canon]) atlas.frames[f] = res.frames[canon];
    else if (res.frames[f]) atlas.frames[f] = res.frames[f];
  }
  for (let i = 0; i < res.nSheets; i++) atlas.sheets.push('atlas-' + (startSheet + i) + '.png');
  fs.writeFileSync(atlasJson, JSON.stringify(atlas));
  fixed++;
  charsFixed += redo.length;
  if (fixed % 20 === 0) console.log(`${fixed} movies, ${charsFixed} chars, ${((Date.now() - t0) / 60000).toFixed(1)}min`);
}
await browser.close();
console.log(`FIM: ${fixed} movies corrigidos, ${charsFixed} chars, ${skipped} skip, ${failedN} falhas, ${((Date.now() - t0) / 60000).toFixed(1)}min`);
