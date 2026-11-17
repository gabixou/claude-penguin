/**
 * iglooStore.js - Persistencia do iglu pessoal (fase 3).
 * Um iglu por jogador: tipo/localizacao/piso/musica + itens posicionados
 * + permissoes (senha / somente amigos) + inventario de mobiliar.
 */

import db from './db.js';
import playerStore from './playerStore.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IGLOO_CATALOG = JSON.parse(
    readFileSync(join(__dirname, 'data', 'igloo-catalog.json'), 'utf8')
);

const now = () => Date.now();

// ---- catalogo ----

export function iglooCatalog() {
    return IGLOO_CATALOG;
}

function catalogEntry(kind, id) {
    const table = IGLOO_CATALOG[kind];
    if (!table) return null;
    const e = table[String(id)];
    return e ? { id: Number(id), ...e } : null;
}

export function furnitureEntry(id) { return catalogEntry('furniture', id); }
export function flooringEntry(id) { return catalogEntry('floorings', id); }
export function iglooEntry(id) { return catalogEntry('igloos', id); }
export function locationEntry(id) {
    const loc = (IGLOO_CATALOG.locations || []).find((l) => Number(l.igloo_location_id) === Number(id));
    return loc ? { id: Number(id), ...loc } : null;
}

// ---- layout ----

function ensureIgloo(playerId) {
    db.prepare(
        `INSERT OR IGNORE INTO igloos (player_id, igloo_type, location, floor, music, updated_at)
         VALUES (?, 1, 1, 0, 0, ?)`
    ).run(playerId, now());
}

export function getIglooRow(playerId) {
    ensureIgloo(playerId);
    return db.prepare('SELECT * FROM igloos WHERE player_id = ?').get(playerId);
}

export function listIglooItems(playerId) {
    return db.prepare(
        'SELECT slot, item_id, x, y, rotation, frame FROM igloo_items WHERE player_id = ? ORDER BY slot'
    ).all(playerId).map((r) => ({
        slot: r.slot, itemId: r.item_id, x: r.x, y: r.y,
        rotation: r.rotation, frame: r.frame,
    }));
}

// Layout publico (sem senha) — o que visitantes recebem.
export function getPublicLayout(ownerId) {
    const row = getIglooRow(ownerId);
    if (!row) return null;
    return {
        ownerId,
        iglooType: row.igloo_type,
        location: row.location,
        floor: row.floor,
        music: row.music,
        friendsOnly: !!row.friends_only,
        hasPassword: !!row.password,
        items: listIglooItems(ownerId),
    };
}

// Layout completo (dono) — inclui a senha para o editor de permissoes.
export function getOwnerLayout(playerId) {
    const pub = getPublicLayout(playerId);
    if (!pub) return null;
    const row = getIglooRow(playerId);
    return { ...pub, password: row.password || '' };
}

// Salva o layout. `patch` aceita iglooType/location/floor/music/items.
// items: [{itemId,x,y,rotation?,frame?}] — substitui a lista inteira
// (o editor envia o estado final; validamos ids contra o catalogo e o
// inventario do jogador — visitante nunca edita, isso e checado no handler).
const MAX_IGLOO_ITEMS = 99; // IGLOO_ITEMS do cliente original
const GRID_MAX_X = 760;    // coords do editor sao pixels do stage 760x480
const GRID_MAX_Y = 480;    // (obj.x/obj.y do AS2, nao celulas)

export function saveLayout(playerId, patch = {}) {
    ensureIgloo(playerId);
    const sets = [];
    const args = [];
    for (const key of ['igloo_type', 'location', 'floor', 'music']) {
        const camel = { igloo_type: 'iglooType', location: 'location', floor: 'floor', music: 'music' }[key];
        if (patch[camel] !== undefined) {
            const v = Math.max(0, Math.min(1000000, Math.round(Number(patch[camel]) || 0)));
            sets.push(`${key} = ?`);
            args.push(v);
        }
    }
    if (sets.length) {
        sets.push('updated_at = ?');
        args.push(now(), playerId);
        db.prepare(`UPDATE igloos SET ${sets.join(', ')} WHERE player_id = ?`).run(...args);
    }

    if (Array.isArray(patch.items)) {
        const owned = new Set(
            db.prepare("SELECT item_id FROM igloo_inventory WHERE player_id = ? AND kind = 'furniture'")
                .all(playerId).map((r) => r.item_id)
        );
        const clean = [];
        for (const it of patch.items.slice(0, MAX_IGLOO_ITEMS)) {
            const itemId = Math.round(Number(it.itemId));
            const x = Math.round(Number(it.x));
            const y = Math.round(Number(it.y));
            if (!itemId || !owned.has(itemId)) continue;
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (x < 0 || x > GRID_MAX_X || y < 0 || y > GRID_MAX_Y) continue;
            clean.push({
                slot: clean.length,
                itemId,
                x, y,
                rotation: Math.max(0, Math.min(3, Math.round(Number(it.rotation) || 0))),
                frame: Math.max(0, Math.min(99, Math.round(Number(it.frame) || 0))),
            });
        }
        db.prepare('DELETE FROM igloo_items WHERE player_id = ?').run(playerId);
        const ins = db.prepare(
            'INSERT INTO igloo_items (player_id, slot, item_id, x, y, rotation, frame) VALUES (?,?,?,?,?,?,?)'
        );
        for (const it of clean) ins.run(playerId, it.slot, it.itemId, it.x, it.y, it.rotation, it.frame);
    }
    return getPublicLayout(playerId);
}

// ---- permissoes ----

export function setPermissions(playerId, { password, friendsOnly } = {}) {
    ensureIgloo(playerId);
    if (password !== undefined) {
        const pw = typeof password === 'string' ? password.slice(0, 32) : '';
        db.prepare('UPDATE igloos SET password = ?, updated_at = ? WHERE player_id = ?')
            .run(pw || null, now(), playerId);
    }
    if (friendsOnly !== undefined) {
        db.prepare('UPDATE igloos SET friends_only = ?, updated_at = ? WHERE player_id = ?')
            .run(friendsOnly ? 1 : 0, now(), playerId);
    }
    return getOwnerLayout(playerId);
}

// Retorna null se acesso livre; 'PASSWORD' ou 'FRIENDS' se bloqueado.
export function checkAccess(ownerId, visitorId, { password, isBuddy } = {}) {
    const row = getIglooRow(ownerId);
    if (!row) return 'NOT_FOUND';
    if (row.friends_only && visitorId !== ownerId && !isBuddy) return 'FRIENDS';
    if (row.password && visitorId !== ownerId) {
        if (!password || password !== row.password) return 'PASSWORD';
    }
    return null;
}

export function areBuddies(a, b) {
    return !!db.prepare(
        "SELECT 1 FROM buddies WHERE player_id = ? AND buddy_id = ? AND status = 'accepted'"
    ).get(a, b);
}

// ---- inventario + compras ----

export function iglooInventory(playerId) {
    return db.prepare('SELECT kind, item_id, quantity FROM igloo_inventory WHERE player_id = ?')
        .all(playerId);
}

function ownedCount(playerId, kind, itemId) {
    const r = db.prepare('SELECT quantity FROM igloo_inventory WHERE player_id = ? AND kind = ? AND item_id = ?')
        .get(playerId, kind, itemId);
    return r ? r.quantity : 0;
}

function addOwned(playerId, kind, itemId, qty = 1) {
    db.prepare(
        `INSERT INTO igloo_inventory (player_id, kind, item_id, quantity) VALUES (?,?,?,?)
         ON CONFLICT(player_id, kind, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`
    ).run(playerId, kind, itemId, qty);
}

// kind: 'furniture' | 'flooring' | 'igloo' | 'location'
// Retorna { ok, layout?, error? } — cobra coins do jogador na compra.
const CATALOG_KEY = { furniture: 'furniture', flooring: 'floorings', igloo: 'igloos', location: 'locations' };

export function buyIglooItem(playerId, kind, itemId) {
    const e = kind === 'location' ? locationEntry(itemId) : catalogEntry(CATALOG_KEY[kind], itemId);
    if (!e) return { error: 'UNKNOWN_ITEM' };
    const cost = Math.max(0, Math.round(Number(e.cost) || 0));
    const player = playerStore.getPlayerById(playerId);
    if (!player) return { error: 'NOT_FOUND' };
    if (player.coins < cost) return { error: 'NO_COINS' };

    // igloo/location: compra = desbloqueia o tipo; floor: desbloqueia o piso.
    // furniture: quantidade (max do catalogo).
    if (kind === 'furniture' && e.max && ownedCount(playerId, 'furniture', itemId) >= e.max) {
        return { error: 'MAX_OWNED' };
    }

    playerStore.updateCoins(playerId, player.coins - cost);
    if (kind === 'furniture') addOwned(playerId, 'furniture', itemId, 1);
    else addOwned(playerId, kind, itemId, 1);
    return { ok: true, coins: player.coins - cost, entry: e };
}

// Decrementa item do inventario ao posicionar? Nao — no CP a mobília
// colocada continua sua (pode remover e repositionar). Mantemos posse.

export default {
    iglooCatalog, getPublicLayout, getOwnerLayout, saveLayout,
    setPermissions, checkAccess, areBuddies, iglooInventory,
    buyIglooItem, furnitureEntry, flooringEntry, iglooEntry, locationEntry,
};
