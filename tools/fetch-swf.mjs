#!/usr/bin/env node
// fetch-swf.mjs — baixa SWFs originais do Club Penguin do Wayback Machine.
//
// O repo https://github.com/d3spi/Club-Penguin-SWF-Archive NAO contem os
// arquivos (os *.swf estao no .gitignore) — ele so documenta que o acervo
// esta no Wayback Machine. Este script resolve o snapshot mais recente via
// CDX API e baixa os bytes originais (sufixo id_).
//
// Uso:
//   node tools/fetch-swf.mjs interface.swf
//   node tools/fetch-swf.mjs artwork/maps/15.swf
//   node tools/fetch-swf.mjs media1.clubpenguin.com/artwork/maps/15.swf
//   node tools/fetch-swf.mjs https://archives.clubpenguinwiki.info/static/rooms/pirate.swf
//   node tools/fetch-swf.mjs --search "catalogue/clothing"
//   node tools/fetch-swf.mjs --flat interface.swf        # salva basename em tools/swfs/
//   node tools/fetch-swf.mjs --ts 20081201000000 town.swf # snapshot especifico
//
// Destino padrao: tools/swfs/<host>/<path> (ex.: tools/swfs/media1.clubpenguin.com/artwork/maps/15.swf)

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'tools', 'swfs');
const CDX = 'https://web.archive.org/cdx/search/cdx';

// Hosts onde o acervo de SWFs foi capturado.
const DEFAULT_HOSTS = [
  'archives.clubpenguinwiki.info',
  'media1.clubpenguin.com',
];

const SWF_MAGIC = ['FWS', 'CWS', 'ZWS'];

function usage(code = 0) {
  console.log(`fetch-swf.mjs — baixa SWFs originais do Club Penguin (Wayback Machine)

Uso:
  node tools/fetch-swf.mjs <alvo> [<alvo>...]
  node tools/fetch-swf.mjs --search <termo>

Alvos aceitos:
  nome.swf                              -> tenta hosts conhecidos + /static/ do wiki
  static/rooms/pirate.swf               -> archives.clubpenguinwiki.info/static/...
  artwork/maps/15.swf                   -> media1.clubpenguin.com/artwork/...
  media1.clubpenguin.com/path/x.swf     -> URL explicita
  http(s)://...                         -> URL completa

Opcoes:
  --search <termo>   Lista URLs arquivadas que contenham o termo (regex escapado)
  --flat             Salva so o basename em tools/swfs/ (padrao: tools/swfs/<host>/<path>)
  --ts <timestamp>   Usa um snapshot especifico (YYYYMMDDhhmmss) em vez do mais recente
  --limit <n>        Max de resultados no --search (padrao 100)
  -h, --help         Esta ajuda
`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { targets: [], flat: false, ts: null, search: null, limit: 100 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage(0);
    else if (a === '--flat') opts.flat = true;
    else if (a === '--ts') opts.ts = argv[++i];
    else if (a === '--search') opts.search = argv[++i];
    else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
    else if (a.startsWith('--')) { console.error(`Opcao desconhecida: ${a}`); usage(1); }
    else opts.targets.push(a);
  }
  return opts;
}

async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

async function fetchBuf(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    }
  }
}

// Converte o argumento do usuario em URLs candidatas (sem scheme).
function candidates(arg) {
  if (/^https?:\/\//i.test(arg)) return [arg.replace(/^https?:\/\//i, '')];
  if (/^[\w.-]+\.(com|net|org|info|net)\//i.test(arg)) return [arg];
  if (arg.startsWith('static/')) return [`archives.clubpenguinwiki.info/${arg}`];
  if (arg.includes('/')) return [`media1.clubpenguin.com/${arg}`];
  // Nome solto: raiz dos hosts + subarvore /static/ do acervo do wiki.
  return [
    ...DEFAULT_HOSTS.map(h => `${h}/${arg}`),
    `archives.clubpenguinwiki.info/static/${arg}`,
  ];
}

async function cdxLookup(url, { matchType, filter } = {}) {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,original,statuscode,mimetype',
    filter: 'statuscode:200',
    collapse: 'digest',
  });
  if (matchType) params.set('matchType', matchType);
  if (filter) params.append('filter', filter);
  params.set('limit', matchType ? String(200) : '-50'); // exato: ultimas 50; busca: primeiras 200
  const data = await fetchJson(`${CDX}?${params}`);
  if (!Array.isArray(data) || data.length < 2) return [];
  return data.slice(1).map(([timestamp, original, statuscode, mimetype]) => ({
    timestamp, original, mimetype,
  }));
}

function pickLatest(rows) {
  if (!rows.length) return null;
  return rows.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
}

async function search(term, limit) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const seen = new Map();
  for (const host of DEFAULT_HOSTS) {
    try {
      const rows = await cdxLookup(host, {
        matchType: 'domain',
        filter: `original:.*${esc}.*`,
      });
      for (const r of rows) seen.set(r.original, r);
    } catch (e) {
      console.error(`  ! busca em ${host} falhou: ${e.message}`);
    }
  }
  const list = [...seen.keys()].sort().slice(0, limit);
  if (!list.length) { console.log('Nenhuma URL arquivada encontrada.'); return; }
  console.log(`${list.length} resultado(s)${list.length >= limit ? ' (truncado)' : ''}:`);
  for (const u of list) console.log(`  ${u}`);
  console.log('\nPara baixar: node tools/fetch-swf.mjs <url-da-lista>');
}

async function download(target, opts) {
  const cands = candidates(target);
  let chosen = null;

  if (opts.ts) {
    // Snapshot fixo: usa a primeira URL candidata que tiver captura naquele ts.
    for (const u of cands) {
      const rows = await cdxLookup(u).catch(() => []);
      const hit = rows.find(r => r.timestamp === opts.ts);
      if (hit) { chosen = hit; break; }
      if (rows.length && rows[0].timestamp === opts.ts) { chosen = rows[0]; break; }
    }
    if (!chosen) { console.error(`Nenhum capture em ${opts.ts} para ${target}`); return false; }
  } else {
    for (const u of cands) {
      let rows = [];
      try { rows = await cdxLookup(u); } catch (e) {
        console.error(`  ! CDX falhou para ${u}: ${e.message}`);
        continue;
      }
      const best = pickLatest(rows);
      if (best) {
        // Prefere SWF de verdade (mimetype) quando houver varios captures.
        chosen = rows.find(r => /swf/i.test(r.mimetype ?? '')) ?? best;
        break;
      }
    }
    if (!chosen) { console.error(`Nenhum SWF arquivado encontrado para: ${target}`); return false; }
  }

  const ts = opts.ts ?? chosen.timestamp;
  const original = chosen.original ?? `http://${cands[0]}`;
  const dlUrl = `https://web.archive.org/web/${ts}id_/${original}`;
  console.log(`${target}\n  -> ${dlUrl}`);

  const buf = await fetchBuf(dlUrl);
  const magic = buf.subarray(0, 3).toString('latin1');
  if (!SWF_MAGIC.includes(magic)) {
    console.warn(`  ! aviso: magic bytes "${magic}" — pode nao ser um SWF valido`);
  }

  const fileUrl = new URL(`http://${cands[0]}`);
  const host = fileUrl.host;
  const rel = decodeURIComponent(fileUrl.pathname).replace(/^\/+/, '');
  const outPath = opts.flat
    ? path.join(OUT_DIR, path.basename(rel))
    : path.join(OUT_DIR, host, rel);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, buf);
  console.log(`  salvo: ${path.relative(ROOT, outPath)} (${buf.length} bytes, ts=${ts})`);
  return true;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.search !== null) {
    if (opts.search === true || !opts.search) { console.error('--search precisa de um termo'); usage(1); }
    await search(opts.search, opts.limit);
    return;
  }
  if (!opts.targets.length) usage(1);

  let ok = 0;
  for (const t of opts.targets) {
    try { if (await download(t, opts)) ok++; }
    catch (e) { console.error(`  ! falhou ${t}: ${e.message}`); }
  }
  console.log(`\n${ok}/${opts.targets.length} arquivo(s) baixado(s).`);
  if (ok < opts.targets.length) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
