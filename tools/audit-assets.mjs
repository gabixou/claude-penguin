#!/usr/bin/env node
// audit-assets.mjs — auditoria de cobertura de assets do cliente.
// Uso: node tools/audit-assets.mjs [--json]
//
// Verifica, para cada item do items.json, se existe a arte
// correspondente em client/public/assets:
//   paper/<id>    — pacote paperdoll (vista do player card /_try-on)
//   clothing/<id> — pack de roupa (chars + timelines)
//   outfits/<id>.gpa — outfit completo para o paperdoll do jogo
// Também lista salas sem pack em movies/ e catalogos sem timelines.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'client', 'public', 'assets');
const asJson = process.argv.includes('--json');

const items = JSON.parse(readFileSync(join(assets, 'items.json'), 'utf8'));

function ids(dir) {
    const p = join(assets, dir);
    return existsSync(p) ? new Set(readdirSync(p)) : new Set();
}

const paper = ids('paper');
const clothing = ids('clothing');
const outfits = new Set(
    existsSync(join(assets, 'outfits'))
        ? readdirSync(join(assets, 'outfits')).map((f) => f.replace(/\.gpa$/, ''))
        : []
);
const movies = ids('movies');
const catalogues = ids('catalogues');

// Salas esperadas (mesma lista do server/src/rooms.js)
const EXPECTED_ROOMS = [
    'town', 'coffee', 'dance', 'pizza', 'plaza', 'forts', 'dojo', 'beach',
    'dock', 'lodge', 'mine', 'rink', 'shop', 'book', 'boiler', 'lounge',
    'pet', 'cave', 'stage', 'forest', 'light', 'ship', 'village', 'attic',
    'dojoext', 'cavemine', 'mtn', 'cove', 'shack', 'berg',
];

const TYPE_NAMES = {
    1: 'cor', 2: 'background/photo?', 3: 'rosto', 4: 'pescoco?',
    5: 'camiseta', 6: 'calca?', 7: 'sapato?', 8: 'chapeu?',
    9: 'outro', 10: 'outro',
};

const missing = { paper: [], clothing: [], outfits: [] };
const byType = {};

for (const item of items) {
    const id = String(item.id);
    const t = item.type;
    byType[t] = byType[t] || { total: 0, missingPaper: 0, missingClothing: 0, missingOutfit: 0 };
    byType[t].total++;
    if (!paper.has(id)) { missing.paper.push(item.id); byType[t].missingPaper++; }
    if (!clothing.has(id)) { missing.clothing.push(item.id); byType[t].missingClothing++; }
    if (!outfits.has(id)) { missing.outfits.push(item.id); byType[t].missingOutfit++; }
}

const missingRooms = EXPECTED_ROOMS.filter((r) => !movies.has(r));
const missingCatalogues = EXPECTED_ROOMS.filter((r) => !catalogues.has(r));

const report = {
    items: items.length,
    coverage: {
        paper: items.length - missing.paper.length,
        clothing: items.length - missing.clothing.length,
        outfits: items.length - missing.outfits.length,
    },
    missingRooms,
    missingCatalogues,
    byType,
    missingIds: {
        paper: missing.paper.slice(0, 500),
        clothing: missing.clothing.slice(0, 500),
        outfits: missing.outfits.slice(0, 500),
    },
};

if (asJson) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log(`Itens no catálogo: ${report.items}`);
    console.log(`Cobertura — paper: ${report.coverage.paper} | clothing: ${report.coverage.clothing} | outfits: ${report.coverage.outfits}`);
    console.log('\nPor tipo (type: total / faltam paper / faltam clothing / faltam outfit):');
    for (const [t, s] of Object.entries(byType).sort((a, b) => a[0] - b[0])) {
        console.log(`  tipo ${t} (${TYPE_NAMES[t] || '?'}): ${s.total} — faltam ${s.missingPaper}/${s.missingClothing}/${s.missingOutfit}`);
    }
    if (missingRooms.length) console.log(`\nSalas sem pack em movies/: ${missingRooms.join(', ')}`);
    if (missingCatalogues.length) console.log(`Catálogos sem pack: ${missingCatalogues.join(', ')}`);
    console.log(`\nIDs sem arte (primeiros 500 por categoria) — use --json para lista completa.`);
}
