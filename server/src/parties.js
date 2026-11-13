/**
 * parties.js - Festas (Fase 8): tabela de festas, substituições por
 * festa, relógio do servidor e progresso do jogador.
 *
 * - parties: id, name, start_at, end_at (ms UTC), timezone (rótulo),
 *   status (scheduled/active/cancelled), created_by, created_at.
 *   O relógio DO SERVIDOR decide qual festa está ativa — o cliente
 *   nunca envia datas.
 * - party_substitutions: por festa, substitui pacote de sala
 *   (movies-party/<party>/<pack>), música, catálogo, itens grátis,
 *   salas extras e mapa.
 * - player_party: progresso do jogador na festa (tarefas, mensagens
 *   vistas) — chave (player_id, party_id).
 */

import db from './db.js';

// ---------- Festas ----------

export function listParties() {
    return db.prepare('SELECT * FROM parties ORDER BY start_at').all();
}

export function getParty(id) {
    return db.prepare('SELECT * FROM parties WHERE id = ?').get(id);
}

// Festa ativa AGORA pelo relógio do servidor (menor start entre as
// que cobrem o instante; empate -> a mais recente cadastrada).
export function activeParty(now = Date.now()) {
    return db.prepare(`
        SELECT * FROM parties
        WHERE status != 'cancelled' AND start_at <= ? AND end_at > ?
        ORDER BY start_at DESC LIMIT 1
    `).get(now, now) || null;
}

// Pré-visualização: qual festa estaria ativa num instante arbitrário.
export function previewParty(at) {
    return activeParty(at);
}

export function createParty({ name, startAt, endAt, timezone = null, createdBy = null }) {
    const info = db.prepare(`
        INSERT INTO parties (name, start_at, end_at, timezone, status, created_by, created_at)
        VALUES (?, ?, ?, ?, 'scheduled', ?, ?)
    `).run(String(name).substring(0, 80), Number(startAt), Number(endAt), timezone, createdBy, Date.now());
    return info.lastInsertRowid;
}

export function updateParty(id, fields) {
    const allowed = { name: 'name', startAt: 'start_at', endAt: 'end_at', timezone: 'timezone', status: 'status' };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(allowed)) {
        if (fields[k] !== undefined) { sets.push(`${col} = ?`); vals.push(fields[k]); }
    }
    if (!sets.length) return;
    vals.push(id);
    db.prepare(`UPDATE parties SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteParty(id) {
    db.prepare('DELETE FROM party_substitutions WHERE party_id = ?').run(id);
    db.prepare('DELETE FROM parties WHERE id = ?').run(id);
}

// ---------- Substituições ----------

export function listSubstitutions(partyId) {
    return db.prepare('SELECT * FROM party_substitutions WHERE party_id = ?').all(partyId);
}

export function setSubstitution(partyId, { roomId = null, kind, value }) {
    // kind: package|music|catalogue|free_items|extra_rooms|map
    db.prepare(`
        INSERT INTO party_substitutions (party_id, room_id, kind, value, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(party_id, room_id, kind) DO UPDATE SET value = excluded.value
    `).run(partyId, roomId, kind, String(value).substring(0, 500), Date.now());
}

export function deleteSubstitution(partyId, roomId, kind) {
    db.prepare('DELETE FROM party_substitutions WHERE party_id=? AND room_id IS ? AND kind=?')
        .run(partyId, roomId, kind);
}

// Mapa roomId -> { package?, music?, ... } para o cliente aplicar.
export function substitutionsForClient(partyId) {
    const subs = listSubstitutions(partyId);
    const out = {};
    const global = {};
    for (const s of subs) {
        const entry = { [s.kind]: s.value };
        if (s.room_id) {
            out[s.room_id] = { ...(out[s.room_id] || {}), ...entry };
        } else {
            Object.assign(global, entry);
        }
    }
    return { byRoom: out, global };
}

// Payload enxuto enviado ao cliente no login / PARTY_UPDATE.
export function partyClientData(party) {
    if (!party) return null;
    return {
        id: party.id,
        name: party.name,
        startAt: party.start_at,
        endAt: party.end_at,
        timezone: party.timezone,
        substitutions: substitutionsForClient(party.id),
    };
}

// ---------- Progresso do jogador na festa ----------

export function getProgress(playerId, partyId) {
    const row = db.prepare('SELECT * FROM player_party WHERE player_id=? AND party_id=?').get(playerId, partyId);
    return row ? {
        tasks: row.tasks ? JSON.parse(row.tasks) : {},
        messagesSeen: row.messages_seen ? JSON.parse(row.messages_seen) : [],
        updatedAt: row.updated_at,
    } : { tasks: {}, messagesSeen: [], updatedAt: null };
}

export function mergeProgress(playerId, partyId, { tasks = null, messagesSeen = null } = {}) {
    const cur = getProgress(playerId, partyId);
    const mergedTasks = { ...cur.tasks, ...(tasks || {}) };
    const seen = new Set([...(cur.messagesSeen || []), ...(messagesSeen || [])]);
    db.prepare(`
        INSERT INTO player_party (player_id, party_id, tasks, messages_seen, updated_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT(player_id, party_id) DO UPDATE SET
            tasks = excluded.tasks, messages_seen = excluded.messages_seen, updated_at = excluded.updated_at
    `).run(playerId, partyId, JSON.stringify(mergedTasks),
        JSON.stringify([...seen].slice(-500)), Date.now());
    return getProgress(playerId, partyId);
}
