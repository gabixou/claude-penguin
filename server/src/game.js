/**
 * game.js - Sistemas de jogo (Fase 6): amigos, ignorados, iglu,
 * puffles, correio, selos, jogos de mesa, card-jitsu, EPF/missões,
 * códigos de resgate, configurações e jornal.
 *
 * Cada op chega como GAME_OP { system, action, ... } ou ops dedicadas
 * (FRIEND_ADD etc.) — handleGameOp retorna true se tratou o pacote.
 */

import crypto from 'crypto';
import db from './db.js';
import playerStore from './playerStore.js';
import * as accounts from './accounts.js';
import * as mod from './moderation.js';
import * as parties from './parties.js';
import catalog from './catalog.js';

// Hooks do index.js (estado WS em memória)
const hooks = { getSocket: null, notify: null };
export function setGameHooks(h) { Object.assign(hooks, h || {}); }

const PUFFLE_SPECIES = ['aurora', 'cosmic', 'crimson', 'lava', 'mint', 'orange', 'patrol', 'pickle', 'skull', 'tundra'];
const PUFFLE_ACTIONS = { feed: 'hunger', play: 'happiness', clean: 'clean', sleep: 'energy', medicine: 'sleep' };
const PUFFLE_MAX = 3;
const IGLOO_SLOTS = 40;
const STAMP_CATALOG = Array.from({ length: 120 }, (_, i) => i + 1); // selos 1..120
const EPF_MISSIONS = [
    { id: 'join_room', title: 'Visite uma sala', target: 1, reward: 50 },
    { id: 'send_chat', title: 'Fale no chat', target: 5, reward: 25 },
    { id: 'buy_item', title: 'Compre um item', target: 1, reward: 100 },
    { id: 'earn_coins', title: 'Ganhe 500 coins', target: 500, reward: 75 },
    { id: 'add_friend', title: 'Adicione um amigo', target: 1, reward: 50 },
    { id: 'send_mail', title: 'Envie um cartão-postal', target: 1, reward: 40 },
    { id: 'earn_stamp', title: 'Ganhe um selo', target: 1, reward: 60 },
];
const TABLE_GAMES = new Set(['findfour', 'mancala', 'treasurehunt', 'sledrace']);
const REDEEM_MIN_LEN = 4;

function send(ws, op, data = {}) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ op, data }));
}
function reply(ws, ok, data = {}) {
    send(ws, ok ? 'GAME_OK' : 'GAME_ERROR', ok ? data : { error: data.error || 'Erro', ...data });
}
function fail(ws, msg) { reply(ws, false, { error: msg }); }
function now() { return Date.now(); }

function getUsername(playerId) {
    return playerStore.getPlayerById(playerId)?.username || playerId;
}
function playerOnline(playerId) {
    return !!(hooks.getSocket && hooks.getSocket(playerId));
}
function notify(playerId, op, data) {
    const ws = hooks.getSocket?.(playerId);
    if (ws) send(ws, op, data);
}

// ---------- Amigos / ignorados ----------

function listFriends(playerId) {
    return db.prepare(`
        SELECT f.friend_id AS playerId, p.username, f.created_at AS since
        FROM friends f JOIN players p ON p.player_id = f.friend_id
        WHERE f.player_id = ? ORDER BY p.username
    `).all(playerId).map((r) => ({ ...r, online: playerOnline(r.playerId) }));
}

function listIgnores(playerId) {
    return db.prepare(`
        SELECT i.ignored_id AS playerId, p.username, i.created_at AS since
        FROM ignores i JOIN players p ON p.player_id = i.ignored_id
        WHERE i.player_id = ? ORDER BY p.username
    `).all(playerId);
}

function resolveTargetPlayer(by) {
    // aceita playerId ou username
    if (by?.playerId) return playerStore.getPlayerById(by.playerId);
    if (by?.username) return playerStore.getPlayerByUsernameKey(accounts.usernameKey(by.username));
    return null;
}

// ---------- Iglu ----------

function getIgloo(playerId) {
    let row = db.prepare('SELECT * FROM igloos WHERE player_id = ?').get(playerId);
    if (!row) {
        db.prepare('INSERT INTO igloos (player_id, updated_at) VALUES (?, ?)').run(playerId, now());
        row = { player_id: playerId, name: 'Meu Iglu', theme: null, floor_item_id: null };
    }
    const furniture = db.prepare(
        'SELECT slot, item_id AS itemId FROM igloo_furniture WHERE player_id = ? ORDER BY slot'
    ).all(playerId);
    return { name: row.name, theme: row.theme, floorItemId: row.floor_item_id, furniture };
}

// ---------- Puffles ----------

const PUFFLE_TICK_MS = 10 * 60 * 1000; // stats decaem a cada 10 min offline

function pufflePublic(p) {
    return {
        id: p.id, species: p.species, name: p.name,
        hunger: p.hunger, happiness: p.happiness, energy: p.energy,
        sleep: p.sleep, clean: p.clean,
    };
}

function decayPuffle(p) {
    const elapsed = Math.min(48 * 60 * 60 * 1000, now() - p.last_tick);
    const ticks = Math.floor(elapsed / PUFFLE_TICK_MS);
    if (ticks <= 0) return p;
    const dec = (v, d) => Math.max(0, Math.min(100, v - d * ticks));
    const upd = db.prepare(`UPDATE puffles SET hunger=?, happiness=?, energy=?, sleep=?, clean=?, last_tick=? WHERE id=?`)
        .run(dec(p.hunger, 2), dec(p.happiness, 1), dec(p.energy, 2), dec(p.sleep, 1), dec(p.clean, 3), now(), p.id);
    return { ...p, hunger: dec(p.hunger, 2), happiness: dec(p.happiness, 1), energy: dec(p.energy, 2), sleep: dec(p.sleep, 1), clean: dec(p.clean, 3), last_tick: now() };
}

// cooldown de cuidado por puffle (memória; zera no restart — aceitável)
const puffleCareCooldown = new Map(); // puffleId -> timestamp
const PUFFLE_CARE_CD_MS = 60 * 1000;

function listPuffles(playerId) {
    return db.prepare('SELECT * FROM puffles WHERE player_id = ? ORDER BY id').all(playerId).map(decayPuffle).map(pufflePublic);
}

// ---------- Correio ----------

function listMail(playerId, { unreadOnly = false } = {}) {
    return db.prepare(`
        SELECT m.id, m.subject, m.body, m.item_id AS itemId, m.coins,
               m.created_at AS createdAt, m.read_at AS readAt,
               s.username AS senderName
        FROM mail m JOIN players s ON s.player_id = m.sender_id
        WHERE m.recipient_id = ? AND m.deleted_at IS NULL
          ${unreadOnly ? 'AND m.read_at IS NULL' : ''}
        ORDER BY m.id DESC LIMIT 100
    `).all(playerId);
}

// ---------- EPF / missões ----------

function ensureMissions(playerId) {
    const ins = db.prepare(`
        INSERT OR IGNORE INTO player_missions (player_id, mission_id, progress, target, updated_at)
        VALUES (?, ?, 0, ?, ?)
    `);
    for (const m of EPF_MISSIONS) ins.run(playerId, m.id, m.target, now());
}

function bumpMission(playerId, missionId, amount = 1) {
    ensureMissions(playerId);
    db.prepare(`
        UPDATE player_missions SET progress = MIN(target, progress + ?), updated_at = ?
        WHERE player_id = ? AND mission_id = ? AND claimed = 0
    `).run(amount, now(), playerId, missionId);
}

// Gancho para o index.js registrar progresso de missões EPF
// em eventos do jogo (entrar em sala, chat, compra, etc.)
export function noteMission(playerId, missionId, amount = 1) {
    try { bumpMission(playerId, missionId, amount); } catch { /* best-effort */ }
}

function epfState(playerId) {
    ensureMissions(playerId);
    let epf = db.prepare('SELECT * FROM player_epf WHERE player_id = ?').get(playerId);
    if (!epf) {
        db.prepare('INSERT INTO player_epf (player_id, updated_at) VALUES (?, ?)').run(playerId, now());
        epf = { level: 1, xp: 0 };
    }
    const rows = db.prepare('SELECT * FROM player_missions WHERE player_id = ?').all(playerId);
    const byId = new Map(rows.map((r) => [r.mission_id, r]));
    const missions = EPF_MISSIONS.map((m) => {
        const r = byId.get(m.id) || { progress: 0, target: m.target, claimed: 0 };
        return { ...m, progress: r.progress, target: r.target, claimed: !!r.claimed, done: r.progress >= r.target };
    });
    return { level: epf.level, xp: epf.xp, missions };
}

// ---------- Jogos de mesa ----------

function queueState(playerId, game) {
    const waiting = db.prepare(`
        SELECT id, player_a AS playerA, created_at AS createdAt FROM game_sessions
        WHERE game = ? AND status = 'waiting' AND player_a != ?
        ORDER BY id LIMIT 1
    `).get(game, playerId);
    const mine = db.prepare(`
        SELECT * FROM game_sessions WHERE status IN ('waiting','active')
        AND (player_a = ? OR player_b = ?) ORDER BY id DESC LIMIT 1
    `).get(playerId, playerId);
    return { waiting, mine };
}

// ---------- Handler principal ----------

// session = { playerId, username, ... } de clientPlayerData
export function handleGameOp(ws, session, packet) {
    const { op, data = {} } = packet;
    const pid = session.playerId;
    const me = playerStore.getPlayerById(pid);
    if (!me) { fail(ws, 'Jogador não encontrado'); return true; }

    // ---- Amigos ----
    if (op === 'FRIEND_LIST') { reply(ws, true, { friends: listFriends(pid) }); return true; }
    if (op === 'FRIEND_ADD') {
        const target = resolveTargetPlayer(data);
        if (!target) { fail(ws, 'Jogador não encontrado'); return true; }
        if (target.player_id === pid) { fail(ws, 'Não pode adicionar a si mesmo'); return true; }
        if (db.prepare('SELECT 1 FROM ignores WHERE player_id=? AND ignored_id=?').get(pid, target.player_id)) {
            fail(ws, 'Você ignora este jogador'); return true;
        }
        db.prepare('INSERT OR IGNORE INTO friends (player_id, friend_id, created_at) VALUES (?,?,?)')
            .run(pid, target.player_id, now());
        db.prepare('INSERT OR IGNORE INTO friends (player_id, friend_id, created_at) VALUES (?,?,?)')
            .run(target.player_id, pid, now()); // amizade mútua
        bumpMission(pid, 'add_friend');
        notify(target.player_id, 'FRIEND_UPDATE', { friends: listFriends(target.player_id) });
        reply(ws, true, { friends: listFriends(pid) });
        return true;
    }
    if (op === 'FRIEND_REMOVE') {
        const target = resolveTargetPlayer(data);
        if (!target) { fail(ws, 'Jogador não encontrado'); return true; }
        db.prepare('DELETE FROM friends WHERE (player_id=? AND friend_id=?) OR (player_id=? AND friend_id=?)')
            .run(pid, target.player_id, target.player_id, pid);
        notify(target.player_id, 'FRIEND_UPDATE', { friends: listFriends(target.player_id) });
        reply(ws, true, { friends: listFriends(pid) });
        return true;
    }
    if (op === 'IGNORE_LIST') { reply(ws, true, { ignores: listIgnores(pid) }); return true; }
    if (op === 'IGNORE_ADD') {
        const target = resolveTargetPlayer(data);
        if (!target) { fail(ws, 'Jogador não encontrado'); return true; }
        db.prepare('INSERT OR IGNORE INTO ignores (player_id, ignored_id, created_at) VALUES (?,?,?)')
            .run(pid, target.player_id, now());
        db.prepare('DELETE FROM friends WHERE (player_id=? AND friend_id=?) OR (player_id=? AND friend_id=?)')
            .run(pid, target.player_id, target.player_id, pid);
        reply(ws, true, { ignores: listIgnores(pid) });
        return true;
    }
    if (op === 'IGNORE_REMOVE') {
        const target = resolveTargetPlayer(data);
        if (!target) { fail(ws, 'Jogador não encontrado'); return true; }
        db.prepare('DELETE FROM ignores WHERE player_id=? AND ignored_id=?').run(pid, target.player_id);
        reply(ws, true, { ignores: listIgnores(pid) });
        return true;
    }

    // ---- Iglu ----
    if (op === 'IGLOO_GET') { reply(ws, true, { igloo: getIgloo(pid) }); return true; }
    if (op === 'IGLOO_SET') {
        const name = typeof data.name === 'string' ? data.name.substring(0, 40) : null;
        const theme = typeof data.theme === 'string' ? data.theme.substring(0, 40) : null;
        const floorItemId = data.floorItemId === null ? null : (Number.isInteger(Number(data.floorItemId)) ? Number(data.floorItemId) : undefined);
        if (floorItemId === undefined) { fail(ws, 'floorItemId inválido'); return true; }
        db.prepare(`INSERT INTO igloos (player_id, name, theme, floor_item_id, updated_at) VALUES (?,?,?,?,?)
                    ON CONFLICT(player_id) DO UPDATE SET
                      name = COALESCE(excluded.name, igloos.name),
                      theme = COALESCE(excluded.theme, igloos.theme),
                      floor_item_id = COALESCE(excluded.floor_item_id, igloos.floor_item_id),
                      updated_at = excluded.updated_at`)
            .run(pid, name || 'Meu Iglu', theme, floorItemId, now());
        reply(ws, true, { igloo: getIgloo(pid) });
        return true;
    }
    if (op === 'IGLOO_FURNITURE_SET') {
        const slot = Math.trunc(Number(data.slot));
        const itemId = data.itemId === null ? null : Number(data.itemId);
        if (!Number.isInteger(slot) || slot < 0 || slot >= IGLOO_SLOTS) { fail(ws, 'Slot inválido'); return true; }
        if (itemId !== null && (!Number.isInteger(itemId) || itemId <= 0)) { fail(ws, 'Item inválido'); return true; }
        if (itemId !== null && catalog.isLoaded() && !catalog.getItem(itemId)) { fail(ws, 'Item não existe no catálogo'); return true; }
        if (itemId === null) {
            db.prepare('DELETE FROM igloo_furniture WHERE player_id=? AND slot=?').run(pid, slot);
        } else {
            db.prepare('INSERT INTO igloo_furniture (player_id, slot, item_id) VALUES (?,?,?) ON CONFLICT(player_id,slot) DO UPDATE SET item_id=excluded.item_id')
                .run(pid, slot, itemId);
        }
        reply(ws, true, { igloo: getIgloo(pid) });
        return true;
    }

    // ---- Puffles ----
    if (op === 'PUFFLE_LIST') { reply(ws, true, { puffles: listPuffles(pid) }); return true; }
    if (op === 'PUFFLE_ADOPT') {
        const count = db.prepare('SELECT COUNT(*) n FROM puffles WHERE player_id=?').get(pid).n;
        if (count >= PUFFLE_MAX) { fail(ws, `Máximo de ${PUFFLE_MAX} puffles`); return true; }
        const species = String(data.species || 'orange').toLowerCase();
        if (!PUFFLE_SPECIES.includes(species)) { fail(ws, 'Espécie inválida'); return true; }
        const name = String(data.name || 'Puffle').substring(0, 20);
        const info = db.prepare(`INSERT INTO puffles (player_id, species, name, last_tick, adopted_at)
                                 VALUES (?,?,?,?,?)`).run(pid, species, name, now(), now());
        reply(ws, true, { puffle: pufflePublic(db.prepare('SELECT * FROM puffles WHERE id=?').get(info.lastInsertRowid)) });
        return true;
    }
    if (op === 'PUFFLE_CARE') {
        const p = db.prepare('SELECT * FROM puffles WHERE id=? AND player_id=?').get(Number(data.puffleId), pid);
        if (!p) { fail(ws, 'Puffle não encontrado'); return true; }
        const stat = PUFFLE_ACTIONS[data.action];
        if (!stat) { fail(ws, 'Ação inválida'); return true; }
        // cooldown de 60s por puffle
        const cur = decayPuffle(p);
        const lastCare = puffleCareCooldown.get(p.id) || 0;
        if (now() - lastCare < PUFFLE_CARE_CD_MS) { fail(ws, 'Aguarde um minuto entre cuidados'); return true; }
        puffleCareCooldown.set(p.id, now());
        const boost = data.action === 'medicine' ? -10 : 25;
        const nv = Math.max(0, Math.min(100, cur[stat] + boost));
        db.prepare(`UPDATE puffles SET ${stat}=?, last_tick=? WHERE id=?`).run(nv, now(), p.id);
        reply(ws, true, { puffles: listPuffles(pid) });
        return true;
    }
    if (op === 'PUFFLE_DELETE') {
        db.prepare('DELETE FROM puffles WHERE id=? AND player_id=?').run(Number(data.puffleId), pid);
        reply(ws, true, { puffles: listPuffles(pid) });
        return true;
    }

    // ---- Correio ----
    if (op === 'MAIL_LIST') {
        reply(ws, true, { mail: listMail(pid), unread: listMail(pid, { unreadOnly: true }).length });
        return true;
    }
    if (op === 'MAIL_SEND') {
        const target = resolveTargetPlayer(data.to ? { username: data.to } : data);
        if (!target) { fail(ws, 'Destinatário não encontrado'); return true; }
        if (target.player_id === pid) { fail(ws, 'Não pode enviar para si mesmo'); return true; }
        const subject = String(data.subject || '').substring(0, 80);
        const body = String(data.body || '').substring(0, 1000);
        if (!body) { fail(ws, 'Mensagem vazia'); return true; }
        // taxa de envio: máx 20/dia
        const today = new Date().toISOString().slice(0, 10);
        const sent = db.prepare(`SELECT COUNT(*) n FROM mail WHERE sender_id=? AND created_at > ?`)
            .get(pid, Date.parse(today)).n;
        if (sent >= 20) { fail(ws, 'Limite diário de envios atingido'); return true; }
        // item/coins opcionais: valida posse
        let itemId = null, coins = null;
        if (data.itemId) {
            itemId = Number(data.itemId);
            if (!playerStore.hasItem(pid, itemId)) { fail(ws, 'Você não possui este item'); return true; }
        }
        if (data.coins) {
            coins = Math.max(0, Math.min(100000, Math.trunc(Number(data.coins))));
            if (playerStore.getPlayerSummary(pid).coins < coins) { fail(ws, 'Coins insuficientes'); return true; }
            playerStore.addCoins(pid, -coins);
        }
        db.prepare(`INSERT INTO mail (sender_id, recipient_id, subject, body, item_id, coins, created_at)
                    VALUES (?,?,?,?,?,?,?)`)
            .run(pid, target.player_id, subject, body, itemId, coins, now());
        if (itemId) playerStore.removeItem(pid, itemId, 1);
        bumpMission(pid, 'send_mail');
        notify(target.player_id, 'MAIL_NOTIFY', { from: me.username });
        reply(ws, true, {});
        return true;
    }
    if (op === 'MAIL_READ') {
        const id = Number(data.id);
        const m = db.prepare('SELECT * FROM mail WHERE id=? AND recipient_id=? AND deleted_at IS NULL').get(id, pid);
        if (!m) { fail(ws, 'Carta não encontrada'); return true; }
        if (!m.read_at) db.prepare('UPDATE mail SET read_at=? WHERE id=?').run(now(), id);
        reply(ws, true, { mail: { ...m, senderName: getUsername(m.sender_id) } });
        return true;
    }
    if (op === 'MAIL_DELETE') {
        db.prepare('UPDATE mail SET deleted_at=? WHERE id=? AND recipient_id=?').run(now(), Number(data.id), pid);
        reply(ws, true, {});
        return true;
    }

    // ---- Selos ----
    if (op === 'STAMP_LIST') {
        const owned = db.prepare('SELECT stamp_id AS stampId, obtained_at AS obtainedAt FROM stamps WHERE player_id=? ORDER BY stamp_id')
            .all(pid);
        reply(ws, true, { stamps: owned, catalog: STAMP_CATALOG });
        return true;
    }
    if (op === 'STAMP_EARN') {
        const stampId = Math.trunc(Number(data.stampId));
        if (!STAMP_CATALOG.includes(stampId)) { fail(ws, 'Selo inválido'); return true; }
        const exists = db.prepare('SELECT 1 FROM stamps WHERE player_id=? AND stamp_id=?').get(pid, stampId);
        if (exists) { fail(ws, 'Selo já obtido'); return true; }
        db.prepare('INSERT INTO stamps (player_id, stamp_id, obtained_at) VALUES (?,?,?)').run(pid, stampId, now());
        bumpMission(pid, 'earn_stamp');
        reply(ws, true, { stampId });
        return true;
    }

    // ---- Jogos de mesa ----
    if (op === 'GAME_QUEUE') {
        const game = String(data.game || '').toLowerCase();
        if (!TABLE_GAMES.has(game)) { fail(ws, 'Jogo desconhecido'); return true; }
        if (data.leave) {
            db.prepare(`UPDATE game_sessions SET status='closed', updated_at=? WHERE status='waiting' AND player_a=? AND game=?`)
                .run(now(), pid, game);
            reply(ws, true, { queue: queueState(pid, game) });
            return true;
        }
        const { waiting, mine } = queueState(pid, game);
        if (mine) { reply(ws, true, { queue: { waiting, mine } }); return true; }
        if (waiting) {
            // pareia com o primeiro da fila
            db.prepare(`UPDATE game_sessions SET player_b=?, status='active', updated_at=? WHERE id=?`)
                .run(pid, now(), waiting.id);
            const sessionRow = db.prepare('SELECT * FROM game_sessions WHERE id=?').get(waiting.id);
            // notifica o outro jogador
            const otherId = sessionRow.player_a;
            const otherWs = hooks.getSocket?.(otherId);
            if (otherWs) send(otherWs, 'GAME_MATCH', { game, sessionId: sessionRow.id, state: sessionRow.state ? JSON.parse(sessionRow.state) : null, opponent: me.username });
            reply(ws, true, { queue: { waiting: null, mine: sessionRow }, matched: true });
            return true;
        }
        const info = db.prepare(`INSERT INTO game_sessions (game, player_a, status, created_at, updated_at) VALUES (?,?, 'waiting', ?, ?)`)
            .run(game, pid, now(), now());
        reply(ws, true, { queue: queueState(pid, game), sessionId: info.lastInsertRowid });
        return true;
    }
    if (op === 'GAME_STATE') {
        const sessionRow = db.prepare(`SELECT * FROM game_sessions WHERE id=? AND (player_a=? OR player_b=?)`)
            .get(Number(data.sessionId), pid, pid);
        if (!sessionRow) { fail(ws, 'Sessão não encontrada'); return true; }
        if (data.state !== undefined) {
            db.prepare('UPDATE game_sessions SET state=?, updated_at=? WHERE id=?')
                .run(JSON.stringify(data.state).substring(0, 8000), now(), sessionRow.id);
            const otherId = sessionRow.player_a === pid ? sessionRow.player_b : sessionRow.player_a;
            const otherWs = otherId && hooks.getSocket?.(otherId);
            if (otherWs) send(otherWs, 'GAME_STATE', { game: sessionRow.game, sessionId: sessionRow.id, state: data.state, from: me.username });
        }
        reply(ws, true, { game: sessionRow.game, sessionId: sessionRow.id, state: sessionRow.state ? JSON.parse(sessionRow.state) : null });
        return true;
    }
    if (op === 'GAME_LEAVE') {
        db.prepare(`UPDATE game_sessions SET status='closed', updated_at=? WHERE id=? AND (player_a=? OR player_b=?)`)
            .run(now(), Number(data.sessionId), pid, pid);
        reply(ws, true, {});
        return true;
    }

    // ---- Card-Jitsu ----
    if (op === 'CARDJITSU_STATE') {
        let row = db.prepare('SELECT * FROM cardjitsu WHERE player_id=?').get(pid);
        if (!row) {
            db.prepare('INSERT INTO cardjitsu (player_id, updated_at) VALUES (?,?)').run(pid, now());
            row = { xp: 0, level: 1, wins: 0, losses: 0, deck: null, progress: null };
        }
        reply(ws, true, {
            xp: row.xp, level: row.level, wins: row.wins, losses: row.losses,
            deck: row.deck ? JSON.parse(row.deck) : null,
            progress: row.progress ? JSON.parse(row.progress) : null,
        });
        return true;
    }
    if (op === 'CARDJITSU_RESULT') {
        // Resultado vindo do cliente nao vale mais ("ganhei" era farm de
        // XP): partidas de Card-Jitsu sao arbitradas no servidor
        // (tables.js) e gravam o progresso sozinhas.
        fail(ws, 'Jogue uma partida de Card-Jitsu (TABLE_JOIN game=card)');
        return true;
    }
    // ---- EPF / missões ----
    if (op === 'EPF_STATE') { reply(ws, true, epfState(pid)); return true; }
    if (op === 'EPF_CLAIM') {
        const missionId = String(data.missionId || '');
        const row = db.prepare('SELECT * FROM player_missions WHERE player_id=? AND mission_id=?').get(pid, missionId);
        const tpl = EPF_MISSIONS.find((m) => m.id === missionId);
        if (!row || !tpl) { fail(ws, 'Missão não encontrada'); return true; }
        if (row.claimed) { fail(ws, 'Recompensa já resgatada'); return true; }
        if (row.progress < row.target) { fail(ws, 'Missão incompleta'); return true; }
        db.prepare('UPDATE player_missions SET claimed=1, updated_at=? WHERE player_id=? AND mission_id=?').run(now(), pid, missionId);
        playerStore.addCoins(pid, tpl.reward);
        // XP de EPF
        db.prepare(`INSERT INTO player_epf (player_id, xp, level, updated_at) VALUES (?,?,?,?)
                    ON CONFLICT(player_id) DO UPDATE SET
                      xp = player_epf.xp + excluded.xp,
                      level = MIN(10, 1 + (player_epf.xp + excluded.xp) / 1000),
                      updated_at = excluded.updated_at`)
            .run(pid, tpl.reward, 1, now());
        reply(ws, true, { reward: tpl.reward, coins: playerStore.getPlayerSummary(pid).coins, epf: epfState(pid) });
        return true;
    }

    // ---- Códigos de resgate ----
    if (op === 'REDEEM') {
        const code = String(data.code || '').trim().toUpperCase().replace(/\s+/g, '');
        if (code.length < REDEEM_MIN_LEN) { fail(ws, 'Código inválido'); return true; }
        const row = db.prepare('SELECT * FROM redeem_codes WHERE code=?').get(code);
        if (!row) { fail(ws, 'Código não encontrado'); return true; }
        if (row.expires_at && row.expires_at < now()) { fail(ws, 'Código expirado'); return true; }
        if (row.max_uses && row.uses >= row.max_uses) { fail(ws, 'Código esgotado'); return true; }
        if (db.prepare('SELECT 1 FROM redeem_uses WHERE code=? AND player_id=?').get(code, pid)) {
            fail(ws, 'Você já resgatou este código'); return true;
        }
        // concede recompensa
        let granted = null;
        if (row.reward_type === 'coins') {
            playerStore.addCoins(pid, row.quantity * row.reward_id);
            granted = { coins: row.quantity * row.reward_id };
        } else if (row.reward_type === 'item') {
            playerStore.grantItem(pid, row.reward_id, row.quantity);
            granted = { itemId: row.reward_id, quantity: row.quantity };
        }
        db.prepare('INSERT INTO redeem_uses (code, player_id, created_at) VALUES (?,?,?)').run(code, pid, now());
        db.prepare('UPDATE redeem_codes SET uses = uses + 1 WHERE code=?').run(code);
        reply(ws, true, { code, reward: granted });
        return true;
    }

    // ---- Configurações / jornal ----
    if (op === 'SETTINGS_GET') {
        const row = db.prepare('SELECT settings FROM player_settings WHERE player_id=?').get(pid);
        reply(ws, true, { settings: row ? JSON.parse(row.settings) : {} });
        return true;
    }
    if (op === 'SETTINGS_SET') {
        const settings = JSON.stringify(data.settings || {}).substring(0, 8000);
        db.prepare(`INSERT INTO player_settings (player_id, settings, updated_at) VALUES (?,?,?)
                    ON CONFLICT(player_id) DO UPDATE SET settings=excluded.settings, updated_at=excluded.updated_at`)
            .run(pid, settings, now());
        reply(ws, true, {});
        return true;
    }
    if (op === 'NEWSPAPER_GET') {
        const news = db.prepare('SELECT id, title, body, published_at AS publishedAt FROM newspaper ORDER BY id DESC LIMIT 20').all();
        reply(ws, true, { newspaper: news });
        return true;
    }

    // ---- Festas (Fase 8) ----
    if (op === 'PARTY_INFO') {
        const party = parties.activeParty();
        reply(ws, true, {
            party: parties.partyClientData(party),
            progress: party ? parties.getProgress(pid, party.id) : null,
        });
        return true;
    }
    if (op === 'PARTY_PROGRESS') {
        const party = parties.activeParty();
        if (!party) { fail(ws, 'Nenhuma festa ativa'); return true; }
        const progress = parties.mergeProgress(pid, party.id, {
            tasks: data.tasks && typeof data.tasks === 'object' ? data.tasks : null,
            messagesSeen: Array.isArray(data.messagesSeen) ? data.messagesSeen.slice(0, 100) : null,
        });
        reply(ws, true, { progress });
        return true;
    }

    return false; // op não é do game.js
}
