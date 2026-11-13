#!/usr/bin/env node
// set-edition.mjs — grava datas de vigência (validFrom/validTo) em
// itens do items.json para rodar edições de catálogo.
//
// Uso:
//   node tools/set-edition.mjs --from 2026-12-01 --to 2027-01-31 --ids 1001,1002,1003
//   node tools/set-edition.mjs --from 2026-12-01 --ids 1001-1010   (faixa)
//   node tools/set-edition.mjs --clear --ids 1001                  (remove vigência)
//
// Itens sem validFrom/validTo são sempre válidos. O servidor só
// vende/lista itens dentro da janela (catalog.getAvailableItem);
// quem já possui continua usando normalmente.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const itemsPath = join(root, 'client', 'public', 'assets', 'items.json');

const args = process.argv.slice(2);
function opt(name) {
    const i = args.indexOf('--' + name);
    return i >= 0 ? args[i + 1] : null;
}

const from = opt('from');
const to = opt('to');
const clear = args.includes('--clear');
const idsArg = opt('ids') || '';

if (!clear && !from && !to) {
    console.error('Informe --from/--to (datas ISO) ou --clear, e --ids id1,id2 ou id1-id2');
    process.exit(1);
}

// expande "1,2,5-9" em lista de ids
const wanted = new Set();
for (const part of idsArg.split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) { console.error(`Intervalo inválido: ${part}`); process.exit(1); }
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
    for (let i = a; i <= b; i++) wanted.add(i);
}
if (!wanted.size) { console.error('Nenhum id em --ids'); process.exit(1); }

const items = JSON.parse(readFileSync(itemsPath, 'utf8'));
let changed = 0;
for (const item of items) {
    if (!wanted.has(item.id)) continue;
    if (clear) {
        delete item.validFrom;
        delete item.validTo;
    } else {
        if (from) item.validFrom = from;
        if (to) item.validTo = to;
    }
    changed++;
}

if (!changed) { console.error('Nenhum item encontrado para os ids informados'); process.exit(1); }
writeFileSync(itemsPath, JSON.stringify(items));
console.log(`${changed} item(ns) atualizado(s) em items.json`);
console.log('Lembre-se de reiniciar o servidor (o catálogo é carregado no boot).');
