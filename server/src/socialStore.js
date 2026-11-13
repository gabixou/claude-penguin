// socialStore.js - persistencia de buddies, ignores e pets (SQLite).
import db from './db.js';

const now = () => Date.now();

// ---------- PETS: catalogo server-side (preco autoritativo) ----------
// Especies de pet "soltas" — puffles e mascotes classicos do EPF.
export const PET_SPECIES = [
    { id: 'puffle_blue',   name: 'Blue Puffle',   cost: 1200 },
    { id: 'puffle_pink',   name: 'Pink Puffle',   cost: 1400 },
    { id: 'puffle_black',  name: 'Black Puffle',  cost: 1600 },
    { id: 'puffle_green',  name: 'Green Puffle',  cost: 1800 },
    { id: 'puffle_purple', name: 'Purple Puffle', cost: 2000 },
    { id: 'puffle_red',    name: 'Red Puffle',    cost: 2200 },
    { id: 'puffle_yellow', name: 'Yellow Puffle', cost: 2400 },
    { id: 'puffle_white',  name: 'White Puffle',  cost: 2600 },
    { id: 'puffle_orange', name: 'Orange Puffle', cost: 2800 },
    { id: 'puffle_brown',  name: 'Brown Puffle',  cost: 3000 },
    { id: 'lounge_lizard', name: 'Lounge Lizard', cost: 750 },
    { id: 'cave_croc',     name: 'Cave Crocodile',cost: 900 },
];

export function getPetSpecies(id) {
    return PET_SPECIES.find((s) => s.id === id) || null;
}
export function listPetSpecies() {
    return PET_SPECIES.map((s) => ({ ...s }));
}

// decay de stats: -1 a cada 30min fora do teto (calculado na leitura)
const DECAY_MS = 30 * 60 * 1000;
function decay(stats, adoptedAt, lastTick) {
    const elapsed = Math.max(0, now() - lastTick);
    const steps = Math.floor(elapsed / DECAY_MS);
    return {
        hunger: Math.max(0, stats.hunger - steps),
        happiness: Math.max(0, stats.happiness - steps),
        rest: Math.max(0, (stats.rest ?? 100) - steps),
        _dirty: steps > 0,
    };
}
function persistStats(petRowId, hunger, happiness, rest) {
    db.prepare('UPDATE pets SET hunger = ?, happiness = ?, rest = ?, last_tick = ? WHERE pet_row_id = ?')
        .run(hunger, happiness, rest ?? 100, now(), petRowId);
}

export function getPets(playerId) {
    const rows = db.prepare('SELECT * FROM pets WHERE player_id = ?').all(playerId);
    return rows.map((r) => {
        const d = decay({ hunger: r.hunger, happiness: r.happiness, rest: r.rest }, r.adopted_at, r.last_tick);
        if (d._dirty) persistStats(r.pet_row_id, d.hunger, d.happiness, d.rest);
        return {
            petRowId: r.pet_row_id,
            species: r.species,
            name: r.name,
            hunger: d.hunger,
            happiness: d.happiness,
            rest: d.rest,
            equipped: !!r.equipped,
            adoptedAt: r.adopted_at,
        };
    });
}

export function adoptPet(playerId, speciesId, name) {
    const sp = getPetSpecies(speciesId);
    if (!sp) return { error: 'UNKNOWN_SPECIES' };
    const cleanName = String(name || sp.name).trim().substring(0, 24) || sp.name;
    const res = db.prepare(
        'INSERT INTO pets (player_id, species, name, hunger, happiness, adopted_at, last_tick) VALUES (?, ?, ?, 100, 100, ?, ?)'
    ).run(playerId, speciesId, cleanName, now(), now());
    return { petRowId: Number(res.lastInsertRowid) };
}

export function getPet(playerId, petRowId) {
    return db.prepare('SELECT * FROM pets WHERE player_id = ? AND pet_row_id = ?').get(playerId, petRowId) || null;
}

export function renamePet(playerId, petRowId, name) {
    const clean = String(name || '').trim().substring(0, 24);
    if (!clean) return { error: 'EMPTY_NAME' };
    const r = db.prepare('UPDATE pets SET name = ? WHERE player_id = ? AND pet_row_id = ?').run(clean, playerId, petRowId);
    return r.changes ? { ok: true } : { error: 'NOT_FOUND' };
}

export function releasePet(playerId, petRowId) {
    const r = db.prepare('DELETE FROM pets WHERE player_id = ? AND pet_row_id = ?').run(playerId, petRowId);
    return r.changes ? { ok: true } : { error: 'NOT_FOUND' };
}

export function setPetStats(playerId, petRowId, hunger, happiness, rest) {
    db.prepare('UPDATE pets SET hunger = ?, happiness = ?, rest = ?, last_tick = ? WHERE player_id = ? AND pet_row_id = ?')
        .run(hunger, happiness, rest ?? 100, now(), playerId, petRowId);
    return { ok: true };
}

// equipar/desequipar: so um pet "passeando" por vez — equipar outro
// devolve o anterior pro igloo automaticamente
export function setPetEquipped(playerId, petRowId, on) {
    db.prepare('UPDATE pets SET equipped = 0 WHERE player_id = ?').run(playerId);
    if (on) {
        const r = db.prepare('UPDATE pets SET equipped = 1 WHERE player_id = ? AND pet_row_id = ?').run(playerId, petRowId);
        if (!r.changes) return { error: 'NOT_FOUND' };
    }
    return { ok: true };
}

// pet equipado do jogador (o que "passeia" seguindo o pinguim) ou null
export function getEquippedPet(playerId) {
    return db.prepare('SELECT * FROM pets WHERE player_id = ? AND equipped = 1').get(playerId) || null;
}

// ---------- BUDDIES ----------
// Retorna {buddies:[{playerId,username,status,online}], requests:[...]}
export function getBuddyData(playerId, onlineIds) {
    const rows = db.prepare(
        `SELECT b.buddy_id AS other_id, b.status, p.username
         FROM buddies b JOIN players p ON p.player_id = b.buddy_id
         WHERE b.player_id = ? ORDER BY b.created_at`
    ).all(playerId);
    const buddies = [];
    const requests = []; // pedidos pendentes RECEBIDOS (alguem me adicionou)
    for (const r of rows) {
        if (r.status === 'pending') {
            // pending so aparece como request se EU sou o alvo — aqui player_id sou eu,
            // entao linha pending = EU enviei pedido. Requests recebidos vem de outra query.
            requests.push({ playerId: r.other_id, username: r.username, direction: 'sent' });
        } else {
            buddies.push({
                playerId: r.other_id,
                username: r.username,
                online: onlineIds.has(r.other_id),
            });
        }
    }
    // pedidos recebidos: alguem tem linha pending apontando pra mim
    const incoming = db.prepare(
        `SELECT b.player_id AS other_id, p.username
         FROM buddies b JOIN players p ON p.player_id = b.player_id
         WHERE b.buddy_id = ? AND b.status = 'pending'`
    ).all(playerId);
    for (const r of incoming) {
        requests.push({ playerId: r.other_id, username: r.username, direction: 'received' });
    }
    return { buddies, requests };
}

// Adiciona buddy por username. Retorna {ok, pending?, error?}
export function addBuddy(playerId, targetUsername, onlineIds) {
    const target = db.prepare('SELECT player_id, username FROM players WHERE username = ?').get(targetUsername);
    if (!target) return { error: 'NO_SUCH_PLAYER' };
    if (target.player_id === playerId) return { error: 'SELF' };
    const existing = db.prepare('SELECT status FROM buddies WHERE player_id = ? AND buddy_id = ?')
        .get(playerId, target.player_id);
    if (existing) {
        // ja tenho relacao: se pending eu enviei -> erro; accepted -> erro
        return { error: existing.status === 'accepted' ? 'ALREADY_BUDDY' : 'REQUEST_SENT' };
    }
    const reverse = db.prepare('SELECT status FROM buddies WHERE player_id = ? AND buddy_id = ?')
        .get(target.player_id, playerId);
    if (reverse && reverse.status === 'accepted') return { error: 'ALREADY_BUDDY' };
    if (reverse && reverse.status === 'pending') {
        // ele ja me pediu -> eu aceito direto (mutual)
        db.prepare("UPDATE buddies SET status='accepted' WHERE player_id=? AND buddy_id=?").run(target.player_id, playerId);
        db.prepare("INSERT OR REPLACE INTO buddies (player_id,buddy_id,status,created_at) VALUES (?,?,?,?)")
            .run(playerId, target.player_id, 'accepted', now());
        return { ok: true, autoAccepted: true, targetId: target.player_id };
    }
    db.prepare("INSERT OR REPLACE INTO buddies (player_id,buddy_id,status,created_at) VALUES (?,?,?,?)")
        .run(playerId, target.player_id, 'pending', now());
    return { ok: true, pending: true, targetId: target.player_id, targetUsername: target.username, targetOnline: onlineIds.has(target.player_id) };
}

// Aceita pedido: quem recebe chama acceptBuddy(meuId, requesterId)
export function acceptBuddy(playerId, requesterId) {
    const req = db.prepare("SELECT status FROM buddies WHERE player_id=? AND buddy_id=? AND status='pending'")
        .get(requesterId, playerId);
    if (!req) return { error: 'NO_REQUEST' };
    db.prepare("UPDATE buddies SET status='accepted' WHERE player_id=? AND buddy_id=?").run(requesterId, playerId);
    db.prepare("INSERT OR REPLACE INTO buddies (player_id,buddy_id,status,created_at) VALUES (?,?,?,?)")
        .run(playerId, requesterId, 'accepted', now());
    return { ok: true, buddyId: requesterId };
}

export function declineBuddy(playerId, requesterId) {
    const r = db.prepare("DELETE FROM buddies WHERE player_id=? AND buddy_id=? AND status='pending'").run(requesterId, playerId);
    return r.changes ? { ok: true } : { error: 'NO_REQUEST' };
}

export function cancelBuddyRequest(playerId, targetId) {
    const r = db.prepare("DELETE FROM buddies WHERE player_id=? AND buddy_id=? AND status='pending'").run(playerId, targetId);
    return r.changes ? { ok: true } : { error: 'NO_REQUEST' };
}

export function removeBuddy(playerId, buddyId) {
    db.prepare('DELETE FROM buddies WHERE player_id=? AND buddy_id=?').run(playerId, buddyId);
    db.prepare('DELETE FROM buddies WHERE player_id=? AND buddy_id=?').run(buddyId, playerId);
    return { ok: true };
}

// ---------- IGNORES ----------
export function getIgnores(playerId) {
    const rows = db.prepare(
        `SELECT i.ignored_id AS other_id, p.username
         FROM ignores i JOIN players p ON p.player_id = i.ignored_id
         WHERE i.player_id = ? ORDER BY i.created_at`
    ).all(playerId);
    return rows.map((r) => ({ playerId: r.other_id, username: r.username }));
}

export function ignorePlayer(playerId, ignoredId) {
    if (playerId === ignoredId) return { error: 'SELF' };
    const exists = db.prepare('SELECT 1 FROM players WHERE player_id=?').get(ignoredId);
    if (!exists) return { error: 'NO_SUCH_PLAYER' };
    db.prepare('INSERT OR IGNORE INTO ignores (player_id,ignored_id,created_at) VALUES (?,?,?)')
        .run(playerId, ignoredId, now());
    return { ok: true };
}

export function unignorePlayer(playerId, ignoredId) {
    const r = db.prepare('DELETE FROM ignores WHERE player_id=? AND ignored_id=?').run(playerId, ignoredId);
    return r.changes ? { ok: true } : { error: 'NOT_FOUND' };
}

// conjunto de ids ignorados por um player (para filtrar chat no broadcast)
export function getIgnoreSet(playerId) {
    const rows = db.prepare('SELECT ignored_id FROM ignores WHERE player_id=?').all(playerId);
    return new Set(rows.map((r) => r.ignored_id));
}
