/**
 * catalog.js - Catalogo autoritativo de itens (precos do items.json).
 * Carrega o items.json do cliente (mesma fonte do wardrobe) para que o
 * servidor nao confie no `cost` enviado pelo cliente.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));

// O items.json vive no cliente (public/assets). Copias locais tem
// prioridade: server/src/data/ (deploy) e server/data/.
const candidates = [
    path.join(here, 'data', 'items.json'),
    path.join(here, '..', 'data', 'items.json'),
    path.join(here, '..', '..', 'client', 'public', 'assets', 'items.json'),
];

let byId = new Map();
let loaded = false;

for (const p of candidates) {
    try {
        const raw = readFileSync(p, 'utf8');
        const items = JSON.parse(raw);
        byId = new Map(items.map((i) => [i.id, i]));
        loaded = true;
        console.log(`[catalog] ${byId.size} itens carregados de ${p}`);
        break;
    } catch {
        // tenta o proximo candidato
    }
}

if (!loaded) {
    console.warn('[catalog] items.json nao encontrado — compras serao rejeitadas');
}

export function isLoaded() {
    return loaded;
}

export function getItem(itemId) {
    return byId.get(Number(itemId)) || null;
}

export function getItemCost(itemId) {
    const item = getItem(itemId);
    return item ? (item.cost || 0) : null;
}

// Todos os ids do catalogo — usado pelo flag all_items (pinguim de teste).
export function listAllIds() {
    return [...byId.keys()];
}

export default { isLoaded, getItem, getItemCost, listAllIds };
