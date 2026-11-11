/**
 * playerStore.js - Camada de acesso a dados de jogadores
 * Gerencia players, inventário e equipamento no SQLite (node:sqlite).
 */

import db from './db.js';
import catalog from './catalog.js';
import crypto from 'crypto';
import * as accounts from './accounts.js';
const { isValidUsername, normalizeUsername, usernameKey, legacyGraceActive } = accounts;

const PAPERDOLL_SLOTS = ['feet', 'body', 'neck', 'hand', 'face', 'head'];
// flag = pin/bandeira do player card (item type 8), photo = fundo do card (type 9)
const CARD_SLOTS = ['flag', 'photo'];
const EQUIP_SLOTS = [...PAPERDOLL_SLOTS, ...CARD_SLOTS];
const SLOT_ITEM_TYPE = { flag: 8, photo: 9 };
const STARTING_COINS = 1000;
const DAILY_BONUS = 500;

// ---------- Helpers ----------

function generatePlayerId(ip) {
    const hash = crypto.createHash('sha256').update(ip + Date.now()).digest('hex').substring(0, 12);
    return `p_${hash}`;
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function todayString() {
    return new Date().toISOString().split('T')[0];
}

// ---------- Player CRUD ----------

export function getPlayerBySession(sessionToken) {
    if (!sessionToken) return null;
    const stmt = db.prepare('SELECT * FROM players WHERE session_token = ?');
    const row = stmt.get(sessionToken);
    return row ? hydratePlayer(row) : null;
}

export function getPlayerById(playerId) {
    const stmt = db.prepare('SELECT * FROM players WHERE player_id = ?');
    const row = stmt.get(playerId);
    return row ? hydratePlayer(row) : null;
}

export function getPlayerByIp(ip) {
    const stmt = db.prepare('SELECT * FROM players WHERE ip = ? ORDER BY last_seen DESC LIMIT 1');
    const row = stmt.get(ip);
    return row ? hydratePlayer(row) : null;
}

export function getPlayerByUsername(username) {
    const stmt = db.prepare('SELECT * FROM players WHERE username = ?');
    const row = stmt.get(username);
    return row ? hydratePlayer(row) : null;
}

// Busca case-insensitive via username_key (unicidade de cadastro/login)
export function getPlayerByUsernameKey(key) {
    const stmt = db.prepare('SELECT * FROM players WHERE username_key = ?');
    const row = stmt.get(String(key || '').toLowerCase());
    return row ? hydratePlayer(row) : null;
}

export function createPlayer(ip, username, colorItemId = 1) {
    if (!isValidUsername(username)) {
        throw new Error('Nome de usuário inválido (3-16 caracteres, sem espaços duplos)');
    }

    // Verifica unicidade do nome (case-insensitive)
    const cleanName = normalizeUsername(username);
    const existing = getPlayerByUsernameKey(usernameKey(cleanName));
    if (existing) {
        throw new Error('Nome de usuário já está em uso');
    }

    const playerId = generatePlayerId(ip);
    const sessionToken = generateSessionToken();
    const now = Date.now();

    const stmt = db.prepare(`
        INSERT INTO players (player_id, ip, session_token, username, username_key, color_item_id, coins, created_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(playerId, ip, sessionToken, cleanName, usernameKey(cleanName), colorItemId, STARTING_COINS, now, now);

    // O jogador já "possui" a cor inicial — sem isso o wardrobe mostraria
    // cadeado/preço na própria cor e o SET_COLOR falharia na validação.
    if (Number.isInteger(colorItemId) && colorItemId > 0) {
        addItem(playerId, colorItemId, 1);
    }

    return getPlayerById(playerId);
}

export function updatePlayerSession(playerId, sessionToken) {
    const stmt = db.prepare('UPDATE players SET session_token = ?, last_seen = ? WHERE player_id = ?');
    stmt.run(sessionToken, Date.now(), playerId);
}

export function updatePlayerColor(playerId, colorItemId) {
    const stmt = db.prepare('UPDATE players SET color_item_id = ?, last_seen = ? WHERE player_id = ?');
    stmt.run(colorItemId, Date.now(), playerId);
}

export function renamePlayer(playerId, newUsername) {
    if (!isValidUsername(newUsername)) {
        throw new Error('Nome de usuário inválido');
    }

    const player = getPlayerById(playerId);
    if (!player) throw new Error('Jogador não encontrado');

    // Verifica se já renomeou uma vez
    if (player.name_changed_at) {
        throw new Error('Você já utilizou sua troca de nome');
    }

    // Verifica unicidade (case-insensitive)
    const cleanName = normalizeUsername(newUsername);
    const existing = getPlayerByUsernameKey(usernameKey(cleanName));
    if (existing && existing.player_id !== playerId) {
        throw new Error('Nome de usuário já está em uso');
    }

    const stmt = db.prepare('UPDATE players SET username = ?, username_key = ?, name_changed_at = ?, last_seen = ? WHERE player_id = ?');
    stmt.run(cleanName, usernameKey(cleanName), Date.now(), Date.now(), playerId);

    return getPlayerById(playerId);
}

export function touchPlayer(playerId) {
    const stmt = db.prepare('UPDATE players SET last_seen = ? WHERE player_id = ?');
    stmt.run(Date.now(), playerId);
}

export function applyDailyBonus(playerId) {
    const player = getPlayerById(playerId);
    if (!player) return null;

    const today = todayString();
    const lastBonus = player.last_daily_bonus ? player.last_daily_bonus.split('T')[0] : null;

    if (lastBonus === today) {
        return player; // Já recebeu hoje
    }

    const stmt = db.prepare('UPDATE players SET coins = coins + ?, last_daily_bonus = ?, last_seen = ? WHERE player_id = ?');
    stmt.run(DAILY_BONUS, new Date().toISOString(), Date.now(), playerId);

    return getPlayerById(playerId);
}

// ---------- Inventory ----------

// Pinguim com all_items=1 "possui" todo o catalogo (itens de teste).
function isAllItemsPlayer(playerId) {
    const row = db.prepare('SELECT all_items FROM players WHERE player_id = ?').get(playerId);
    return !!row?.all_items;
}

export function getInventory(playerId) {
    if (isAllItemsPlayer(playerId)) {
        return catalog.listAllIds().map((itemId) => ({ itemId, quantity: 1 }));
    }
    const stmt = db.prepare('SELECT item_id, quantity FROM inventory WHERE player_id = ?');
    const rows = stmt.all(playerId);
    return rows.map(r => ({ itemId: r.item_id, quantity: r.quantity }));
}

export function hasItem(playerId, itemId) {
    if (isAllItemsPlayer(playerId)) return true;
    const stmt = db.prepare('SELECT quantity FROM inventory WHERE player_id = ? AND item_id = ?');
    const row = stmt.get(playerId, itemId);
    return row ? row.quantity > 0 : false;
}

export function setAllItems(playerId, flag = 1) {
    db.prepare('UPDATE players SET all_items = ? WHERE player_id = ?').run(flag ? 1 : 0, playerId);
}

export function updateCoins(playerId, coins) {
    db.prepare('UPDATE players SET coins = ? WHERE player_id = ?').run(Math.max(0, Math.round(coins)), playerId);
}

export function addCoins(playerId, amount) {
    db.prepare('UPDATE players SET coins = MAX(0, coins + ?), last_seen = ? WHERE player_id = ?')
        .run(Math.round(amount), Date.now(), playerId);
}

export function addItem(playerId, itemId, quantity = 1) {
    const stmt = db.prepare(`
        INSERT INTO inventory (player_id, item_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(player_id, item_id) DO UPDATE SET quantity = quantity + ?
    `);
    stmt.run(playerId, itemId, quantity, quantity);
}

export function removeItem(playerId, itemId, quantity = 1) {
    const stmt = db.prepare('SELECT quantity FROM inventory WHERE player_id = ? AND item_id = ?');
    const row = stmt.get(playerId, itemId);
    if (!row || row.quantity < quantity) return false;

    if (row.quantity === quantity) {
        const del = db.prepare('DELETE FROM inventory WHERE player_id = ? AND item_id = ?');
        del.run(playerId, itemId);
    } else {
        const upd = db.prepare('UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?');
        upd.run(quantity, playerId, itemId);
    }
    return true;
}

export function buyItem(playerId, itemId, cost) {
    const player = getPlayerById(playerId);
    if (!player) throw new Error('Jogador não encontrado');

    if (player.coins < cost) {
        throw new Error('Moedas insuficientes');
    }

    // Transação manual (node:sqlite não tem helper de transaction)
    db.exec('BEGIN');
    try {
        const updateCoins = db.prepare('UPDATE players SET coins = coins - ?, last_seen = ? WHERE player_id = ?');
        updateCoins.run(cost, Date.now(), playerId);
        addItem(playerId, itemId, 1);
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }

    return getPlayerById(playerId);
}

// ---------- Equipment ----------

export function getEquipped(playerId) {
    const stmt = db.prepare('SELECT slot, item_id FROM equipped WHERE player_id = ?');
    const rows = stmt.all(playerId);
    const equipped = {};
    for (const slot of EQUIP_SLOTS) {
        equipped[slot] = null;
    }
    for (const row of rows) {
        if (EQUIP_SLOTS.includes(row.slot)) {
            equipped[row.slot] = row.item_id;
        }
    }
    return equipped;
}

export function equipItem(playerId, slot, itemId) {
    if (!EQUIP_SLOTS.includes(slot)) {
        throw new Error('Slot inválido');
    }

    // Se itemId é null, desequipa
    if (itemId === null || itemId === undefined) {
        const del = db.prepare('DELETE FROM equipped WHERE player_id = ? AND slot = ?');
        del.run(playerId, slot);
        return getEquipped(playerId);
    }

    // Valida se o jogador possui o item
    if (!hasItem(playerId, itemId)) {
        throw new Error('Você não possui este item');
    }

    // flag/photo so aceitam o tipo de item correspondente (8/9)
    const wantType = SLOT_ITEM_TYPE[slot];
    if (wantType !== undefined && catalog.isLoaded()) {
        const item = catalog.getItem(itemId);
        if (item && item.type !== wantType) {
            throw new Error('Item inválido para este slot');
        }
    }

    const stmt = db.prepare(`
        INSERT INTO equipped (player_id, slot, item_id)
        VALUES (?, ?, ?)
        ON CONFLICT(player_id, slot) DO UPDATE SET item_id = ?
    `);
    stmt.run(playerId, slot, itemId, itemId);

    return getEquipped(playerId);
}

// ---------- Contas (senha / recovery) ----------

export function setPasswordHash(playerId, passwordHash) {
    db.prepare('UPDATE players SET password_hash = ?, last_seen = ? WHERE player_id = ?')
        .run(passwordHash, Date.now(), playerId);
}

export function setRecoveryCode(playerId, recoveryHash, recoveryLabel) {
    db.prepare('UPDATE players SET recovery_hash = ?, recovery_label = ?, last_seen = ? WHERE player_id = ?')
        .run(recoveryHash, recoveryLabel, Date.now(), playerId);
}

export function getPasswordHash(playerId) {
    const row = db.prepare('SELECT password_hash FROM players WHERE player_id = ?').get(playerId);
    return row?.password_hash || null;
}

export function hasPassword(playerId) {
    return !!getPasswordHash(playerId);
}

export function getRecoveryHash(playerId) {
    const row = db.prepare('SELECT recovery_hash FROM players WHERE player_id = ?').get(playerId);
    return row?.recovery_hash || null;
}

// ---------- Hydration ----------

function hydratePlayer(row) {
    return {
        player_id: row.player_id,
        ip: row.ip,
        session_token: row.session_token,
        username: row.username,
        color_item_id: row.color_item_id,
        coins: row.coins,
        all_items: !!row.all_items,
        has_password: !!row.password_hash,
        last_daily_bonus: row.last_daily_bonus,
        name_changed_at: row.name_changed_at,
        created_at: row.created_at,
        last_seen: row.last_seen,
        inventory: getInventory(row.player_id),
        equipped: getEquipped(row.player_id)
    };
}

// ---------- Public API ----------

export function getPublicPlayerData(playerId) {
    const player = getPlayerById(playerId);
    if (!player) return null;

    return {
        playerId: player.player_id,
        username: player.username,
        colorItemId: player.color_item_id,
        coins: player.coins,
        inventory: player.inventory,
        equipped: player.equipped,
        canRename: !player.name_changed_at,
        allItems: !!player.all_items,
        hasPassword: !!player.has_password,
        needsPasswordSetup: !player.has_password,
        legacyGraceActive: accounts.legacyGraceActive()
    };
}

export default {
    getPlayerBySession,
    getPlayerById,
    getPlayerByIp,
    getPlayerByUsername,
    createPlayer,
    updatePlayerSession,
    setPasswordHash,
    setRecoveryCode,
    getPasswordHash,
    hasPassword,
    getRecoveryHash,
    getPlayerByUsernameKey,
    updatePlayerColor,
    renamePlayer,
    touchPlayer,
    applyDailyBonus,
    getInventory,
    hasItem,
    setAllItems,
    updateCoins,
    addCoins,
    addItem,
    removeItem,
    buyItem,
    getEquipped,
    equipItem,
    getPublicPlayerData
};
