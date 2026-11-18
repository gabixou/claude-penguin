// Bake de frames COMPOSTOS por movie (modelo CPJourney):
// para cada frame da timeline principal, renderiza todas as combinacoes
// (frame principal x sub-frames dos sprites animados) em imagens
// trimmed, pack em sheets webp e grava composed/atlas.json.
//
// Camadas (so movies com paths nomeados body/ring/hotspot — penguin e
// penguin-actions):
//   b = frame inteiro menos ring/hotspot/body  (base sem tint)
//   m = silhueta do subtree 'body' (tint solido em runtime)
//   r = subtree 'ring' (anel de selecao, so jogador local)
// Itens clothing/<id> nao tem paths nomeados -> so camada 'b'.
//
// Saida por movie: <dir>/composed/atlas-N.webp + composed/atlas.json
//   frames: { "<mainF>:<s1>,<s2,...>": { b:{s,x,y,w,h,ox,oy}, m?, r? } }
//   anim:   { "<mainF>": [{path,len},...] }   (ordem = ordem dos subs)
//
// Uso:
//   node tools/atlas/bake-composed.mjs [--only <substr>] [--scale 4]
//        [--sheet 2048] [--frames 2] [--limit N] [--dry]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('only', '');
const SCALE = parseFloat(opt('scale', '4'));      // px por unidade de mundo
const RASTER = parseFloat(opt('raster', '4'));    // supersample do clip.draw
const SHEET = parseInt(opt('sheet', '2048'), 10);
const FRAMES = opt('frames', '');                 // ex.: "2" p/ actions
const LIMIT = parseInt(opt('limit', '0'), 10);    // so primeiros N movies
const DRY = args.includes('--dry');
const COMBO_CAP = 4096; // tuples max por frame (trajetoria real)

// ---- descobre movies alvo ----
const targets = []; // {id, base(url path), dir, kind}
const clothingDir = path.join(ROOT, 'client/public/assets/clothing');
for (const d of fs.readdirSync(clothingDir)) {
  const dir = path.join(clothingDir, d);
  if (fs.existsSync(path.join(dir, 'timelines.json'))) targets.push({ id: 'clothing/' + d, dir, kind: 'item' });
}
const penguinDir = path.join(ROOT, 'client/public/assets/movies/penguin');
if (fs.existsSync(path.join(penguinDir, 'timelines.json'))) targets.push({ id: 'movies/penguin', dir: penguinDir, kind: 'body' });
const actDir = path.join(ROOT, 'client/public/assets/movies/penguin-actions');
if (fs.existsSync(actDir)) {
  for (const d of fs.readdirSync(actDir)) {
    const dir = path.join(actDir, d);
    if (fs.existsSync(path.join(dir, 'timelines.json'))) targets.push({ id: 'movies/penguin-actions/' + d, dir, kind: 'action', frameFilter: FRAMES ? FRAMES.split(',').map(Number) : null });
  }
}
let movies = targets.filter((t) => !ONLY || t.id.includes(ONLY));
if (LIMIT) movies = movies.slice(0, LIMIT);
console.log(`${movies.length} movies p/ composed bake (scale=${SCALE}, sheet=${SHEET})`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
// garante que os modulos resolvem
await page.evaluate(async () => {
  const { MovieRoom } = await import('/src/movie/movie.js');
  const { Clip } = await import('/src/movie/clip.js');
  window.__M = { MovieRoom, Clip };
});

let saveDir = null;
await page.exposeFunction('__bakeSave', async (name, b64) => {
  fs.writeFileSync(path.join(saveDir, name), Buffer.from(b64, 'base64'));
});

const t0 = Date.now();
let done = 0, failed = 0, totalSprites = 0;
for (const mv of movies) {
  const outDir = path.join(mv.dir, 'composed');
  const atlasPath = path.join(outDir, 'atlas.json');
  if (fs.existsSync(atlasPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
      if (!prev.skipped?.length) { done++; continue; }
      console.log('rebake (skipped:', prev.skipped.length + ')', mv.id);
    } catch { /* json corrompido: rebake */ }
  }
  if (DRY) { console.log('DRY', mv.id); done++; continue; }
  saveDir = outDir;
  fs.mkdirSync(outDir, { recursive: true });
  const url = '/assets/' + mv.id;
  try {
    const res = await page.evaluate(async ({ url, kind, SCALE, RASTER, SHEET, frameFilter, COMBO_CAP, }) => {
      const { MovieRoom, Clip } = window.__M;
      const mv = await MovieRoom.load(url);
      const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
      const IDENTC = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
      const PAD = 2;
      const isBodyKind = kind !== 'item';
      const NAMED_HIDE = ['ring', 'hotspot'];
      const results = { frames: {}, anim: {}, mainFrames: 0, skipped: [] };

      let clip = new Clip(mv); // re-criado por frame: state nao vaza entre frames
      const main = mv.data.main || {};
      const nFrames = main.frames?.length || 1;
      results.mainFrames = nFrames;
      const frameList = frameFilter ? frameFilter.filter((f) => f >= 1 && f <= nFrames) : Array.from({ length: nFrames }, (_, i) => i + 1);

      // canvas de probe minusculo p/ descobrir playheads
      const probe = document.createElement('canvas'); probe.width = probe.height = 4;
      const pctx = probe.getContext('2d');

      // descobre anim paths por frame: draw + advance, coleta playheads
      // com timeline>1 e playing
      async function animFor(f) {
        clip.resetPlayback();
        clip.set('', { frame: f, playing: false });
        await clip.draw(pctx, f, 0.05);
        const seen = new Map();
        for (let t = 0; t < 4; t++) { clip.advance(); }
        for (const [p, ph] of clip.playheads) {
          const len = ph.timeline?.frames?.length || 1;
          if (len > 1 && ph.playing) seen.set(p, len);
        }
        // ordena por path p/ chave estavel
        return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([path, len]) => ({ path, len }));
      }

      // trajetoria REAL dos playheads: os sprites animados do
      // pinguim sao sincronizados (mesmo len, tick junto — ex.: dance
      // frame 26 = 3 paths x 193 em lockstep = 193 estados, NAO 7M).
      // Avanca o clip ate o ciclo fechar e grava so os tuples que
      // realmente ocorrem — mesmo conjunto que o runtime vai pedir.
      function trajectory(anim, entries) {
        const IDENTM = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
        const seen = new Set();
        const tuples = [];
        // estado INICIAL real (playheads no frame 1 / resolve de actions):
        // sem o reset a trajetoria comecava pos-animFor (~frame 2-5) e o
        // primeiro estado do ciclo — ex.: '27:1,1,1' do throw — nunca era
        // baked; o runtime pedia a key e caia no fallback clip.draw.
        clip.resetPlayback();
        clip._boundsOf(entries, IDENTM, ''); // cria playheads + marca seen
        for (let t = 0; t < 8192; t++) {
          const subs = anim.map((a) => clip.currentFrame(a.path));
          const k = subs.join(',');
          if (seen.has(k)) break;
          seen.add(k);
          tuples.push(subs);
          clip.advance();
          clip._boundsOf(entries, IDENTM, ''); // re-marca seen p/ proximo tick
        }
        return tuples.length > COMBO_CAP ? null : tuples;
      }

      // aplica visibilidade p/ uma camada e desenha; retorna {cv,bx0,by0,bx1,by1}
      async function renderLayer(f, subs, anim, layer) {
        // reseta visibilidade
        const entries = main.frames?.[f - 1] || [];
        // paths top-level do frame p/ camadas m/r
        const topPaths = [];
        for (const e of entries) {
          const p = e.name ? e.name : '#' + e.depth;
          topPaths.push(p);
        }
        const vis = {};
        // ordem original: conteudo abaixo do body (sombra) < ring < body < sprites acima
        const bi = topPaths.indexOf('body');
        const aboveBody = (p) => bi < 0 || topPaths.indexOf(p) > bi;
        const belowBody = (p) => bi > 0 && topPaths.indexOf(p) < bi;
        if (layer === 'b') {
          if (isBodyKind) {
            for (const p of topPaths) vis[p] = p !== 'body' && aboveBody(p);
            for (const p of NAMED_HIDE) vis[p] = false;
          } else {
            // item de roupa: a camada 'b' e o frame INTEIRO — paths
            // nomeados 'body'/'ring' aqui sao arte do item, nao do pinguim
            for (const p of topPaths) vis[p] = true;
          }
        } else if (layer === 's') {
          for (const p of topPaths) vis[p] = belowBody(p) && p !== 'ring' && p !== 'hotspot';
        } else if (layer === 'm') {
          for (const p of topPaths) vis[p] = p === 'body';
        } else if (layer === 'r') {
          for (const p of topPaths) vis[p] = p === 'ring';
        }
        for (const [p, v] of Object.entries(vis)) clip.set(p, { visible: !!v });
        // aplica sub-frames
        for (let i = 0; i < anim.length; i++) clip.set(anim[i].path, { frame: subs[i], playing: false });
        // bounds do frame (sem layer mask p/ simplificar: bounds cheio)
        const b = clip._boundsOf(entries, IDENT, '') || [-30, -70, 30, 20];
        const x0 = Math.floor(b[0]) - PAD, y0 = Math.floor(b[1]) - PAD;
        const w = Math.ceil(b[2] - b[0] + PAD * 2), h = Math.ceil(b[3] - b[1] + PAD * 2);
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.ceil(w * SCALE)); cv.height = Math.max(1, Math.ceil(h * SCALE));
        const ctx = cv.getContext('2d');
        ctx.setTransform(SCALE, 0, 0, SCALE, -x0 * SCALE, -y0 * SCALE);
        await clip.draw(ctx, f, RASTER);
        return { cv, x0, y0, w, h };
      }

      async function spriteOf(cv) {
        const blob = await new Promise((r) => cv.toBlob(r, 'image/webp', 0.9));
        if (!blob) return null;
        const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
        return b64;
      }

      // ---- loop de frames ----
      const sprites = []; // {b64, w,h, ox,oy, layer, key}
      for (const f of frameList) {
        clip = new Clip(mv); // reset state+playheads por frame
        const anim = await animFor(f);
        results.anim[f] = anim;
        const entries = main.frames?.[f - 1] || [];
        const cs = trajectory(anim, entries);
        if (cs === null) { results.skipped.push(f); continue; }
        for (const subs of cs) {
          const key = f + ':' + subs.join(',');
          const layers = isBodyKind ? ['s', 'r', 'm', 'b'] : ['b'];
          const rec = {};
          for (const layer of layers) {
            const { cv, x0, y0, w, h } = await renderLayer(f, subs, anim, layer);
            const b64 = await spriteOf(cv);
            if (!b64) continue;
            rec[layer] = { b64, w: cv.width, h: cv.height, ox: x0, oy: y0, wu: w, hu: h };
          }
          if (rec.b) sprites.push({ key, rec });
        }
      }
      // ---- pack sheets ----
      const M = 2;
      // flatten: cada layer de cada key = 1 sprite
      const flat = [];
      for (const s of sprites) for (const [layer, r] of Object.entries(s.rec))
        flat.push({ key: s.key, layer, ...r });
      flat.sort((a, b) => b.h - a.h || b.w - a.w);
      const frames = {};
      let sheetIdx = -1, cv = null, ctx = null, cx = 0, cy = 0, rowH = 0;
      
      const SHEET_OF = [];
      const open = () => { sheetIdx++; cv = document.createElement('canvas'); cv.width = cv.height = SHEET; ctx = cv.getContext('2d'); cx = cy = M; rowH = 0; SHEET_OF.push(SHEET); };
      const flush = async () => {
        if (!cv) return;
        const blob = await new Promise((r) => cv.toBlob(r, 'image/webp', 0.92));
        const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
        await window.__bakeSave('atlas-' + sheetIdx + '.webp', b64);
      };
      open();
      let packed = 0;
      for (const it of flat) {
        const W = it.w + M, H = it.h + M;
        if (W > SHEET || H > SHEET) continue; // frames gigantes: fallback runtime
        if (cx + W > SHEET) { cx = M; cy += rowH; rowH = 0; }
        if (cy + H > SHEET) { await flush(); open(); }
        const img = new Image();
        const ok = await new Promise((res2) => {
          img.onload = () => res2(true); img.onerror = () => res2(false);
          img.src = 'data:image/webp;base64,' + it.b64;
        });
        if (!ok) continue;
        ctx.drawImage(img, cx, cy);
        const slot = { s: sheetIdx, x: cx, y: cy, w: it.w, h: it.h, ox: it.ox, oy: it.oy, wu: it.wu, hu: it.hu };
        (frames[it.key] ??= {})[it.layer] = slot;
        cx += W; rowH = Math.max(rowH, H); packed++;
      }
      await flush();
      return {
        atlas: {
          v: 1, scale: SCALE, raster: RASTER, sheet: SHEET,
          sheets: Array.from({ length: sheetIdx + 1 }, (_, i) => 'atlas-' + i + '.webp'),
          sheetSizes: SHEET_OF,
          mainFrames: results.mainFrames,
          anim: results.anim,
          frames,
          skipped: results.skipped,
        },
        stats: { sprites: flat.length, packed, keys: Object.keys(frames).length },
      };
    }, { url, kind: mv.kind, SCALE, RASTER, SHEET, frameFilter: mv.frameFilter || null, COMBO_CAP });

    if (DRY) continue;
    fs.writeFileSync(path.join(outDir, 'atlas.json'), JSON.stringify(res.atlas));
    // remove sheets orfas
    const keep = new Set(res.atlas.sheets);
    for (const f of fs.readdirSync(outDir))
      if (/^atlas-\d+\.webp$/.test(f) && !keep.has(f)) fs.rmSync(path.join(outDir, f));
    totalSprites += res.stats.packed;
    done++;
    if (done % 10 === 0) console.log(`${done}/${movies.length} ${mv.id} sprites=${res.stats.packed} keys=${res.stats.keys} ${(Date.now() - t0) / 1000 | 0}s`);
  } catch (e) {
    console.log('FAIL', mv.id, e.message?.slice(0, 200));
    failed++;
  }
}
await browser.close();
console.log('DONE', done, 'ok,', failed, 'falhas,', totalSprites, 'sprites');
