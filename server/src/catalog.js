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

// ---------- Vigência de catálogo (Fase 7) ----------
// Itens podem ter `validFrom`/`validTo` (ISO date ou timestamp) no
// items.json. Fora da janela o item não é vendável nem listado —
// permite rodar edições de catálogo sem apagar itens do arquivo.
// Quem já possui o item mantém (hasItem não passa pelo catálogo).

function itemValid(item, now = Date.now()) {
    if (!item) return false;
    const from = item.validFrom ? Date.parse(item.validFrom) : null;
    const to = item.validTo ? Date.parse(item.validTo) : null;
    if (from !== null && Number.isFinite(from) && now < from) return false;
    if (to !== null && Number.isFinite(to) && now > to) return false;
    return true;
}

export function isItemAvailable(itemId, now = Date.now()) {
    return itemValid(byId.get(Number(itemId)), now);
}

// Item apenas se está dentro da vigência (para compras/listagens).
export function getAvailableItem(itemId, now = Date.now()) {
    const item = getItem(itemId);
    return itemValid(item, now) ? item : null;
}

// Todos os ids do catalogo — usado pelo flag all_items (pinguim de teste).
export function listAllIds(now = Date.now()) {
    return [...byId.values()].filter((i) => itemValid(i, now)).map((i) => i.id);
}

// Busca por id ou nome (painel admin) — só itens vigentes.
export function searchItems(query, limit = 50, now = Date.now()) {
    const q = String(query || '').trim().toLowerCase();
    const out = [];
    for (const item of byId.values()) {
        if (!itemValid(item, now)) continue;
        if (!q || String(item.id).includes(q) || String(item.name || '').toLowerCase().includes(q)) {
            out.push(item);
            if (out.length >= limit) break;
        }
    }
    return out;
}

export default { isLoaded, getItem, getItemCost, isItemAvailable, getAvailableItem, listAllIds, searchItems };
