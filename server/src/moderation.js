/**
 * moderation.js - Papéis, banimentos, advertências, denúncias,
 * filtro de chat, histórico de login e auditoria.
 */

import db from './db.js';

export const ROLES = { PLAYER: 'player', MODERATOR: 'moderator', ADMIN: 'admin' };
const ROLE_RANK = { player: 0, moderator: 1, admin: 2 };

export function roleRank(role) {
    return ROLE_RANK[role] ?? 0;
}

export function hasRole(player, minRole) {
    return roleRank(player?.role) >= roleRank(minRole);
}

// ---------- Ban ----------

export function activeBan(playerId) {
    const row = db.prepare(`
        SELECT * FROM ban
        WHERE player_id = ? AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY id DESC LIMIT 1
    `).get(playerId, Date.now());
    return row || null;
}

export function isBanned(playerId) {
    return !!activeBan(playerId);
}

export function banPlayer(playerId, { reason = null, moderatorId = null, durationMs = null } = {}) {
    const now = Date.now();
    db.prepare(`
        INSERT INTO ban (player_id, reason, moderator_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(playerId, reason, moderatorId, now, durationMs ? now + durationMs : null);
}

export function unbanPlayer(banId, revokedBy = null) {
    db.prepare('UPDATE ban SET revoked_at = ?, revoked_by = ? WHERE id = ?')
        .run(Date.now(), revokedBy, banId);
}

export function unbanPlayerActive(playerId, revokedBy = null) {
    db.prepare(`
        UPDATE ban SET revoked_at = ?, revoked_by = ?
        WHERE player_id = ? AND revoked_at IS NULL
    `).run(Date.now(), revokedBy, playerId);
}

export function listBans({ status = 'active', limit = 100, offset = 0 } = {}) {
    const now = Date.now();
    if (status === 'active') {
        return db.prepare(`
            SELECT b.*, p.username FROM ban b JOIN players p ON p.player_id = b.player_id
            WHERE b.revoked_at IS NULL AND (b.expires_at IS NULL OR b.expires_at > ?)
            ORDER BY b.id DESC LIMIT ? OFFSET ?
        `).all(now, limit, offset);
    }
    if (status === 'expired') {
        return db.prepare(`
            SELECT b.*, p.username FROM ban b JOIN players p ON p.player_id = b.player_id
            WHERE b.revoked_at IS NULL AND b.expires_at IS NOT NULL AND b.expires_at <= ?
            ORDER BY b.id DESC LIMIT ? OFFSET ?
        `).all(now, limit, offset);
    }
    return db.prepare(`
        SELECT b.*, p.username FROM ban b JOIN players p ON p.player_id = b.player_id
        ORDER BY b.id DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
}

// ---------- Warnings / mute ----------

export function addWarning(playerId, { moderatorId = null, reason = null } = {}) {
    db.prepare(`
        INSERT INTO warning (player_id, moderator_id, reason, created_at)
        VALUES (?, ?, ?, ?)
    `).run(playerId, moderatorId, reason, Date.now());
}

export function listWarnings(playerId) {
    return db.prepare(`
        SELECT w.*, p.username AS moderator_name FROM warning w
        LEFT JOIN players p ON p.player_id = w.moderator_id
        WHERE w.player_id = ? ORDER BY w.id DESC
    `).all(playerId);
}

export function setMutedUntil(playerId, until) {
    db.prepare('UPDATE players SET muted_until = ? WHERE player_id = ?').run(until, playerId);
}

export function isMuted(player) {
    return !!(player?.muted_until && player.muted_until > Date.now());
}

export function getMutedUntil(playerId) {
    const row = db.prepare('SELECT muted_until FROM players WHERE player_id = ?').get(playerId);
    return row?.muted_until || null;
}

// ---------- Reports ----------

export function createReport({ reporterId, targetPlayerId = null, targetMessage = null, reason = null }) {
    const info = db.prepare(`
        INSERT INTO report (reporter_id, target_player_id, target_message, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(reporterId, targetPlayerId, targetMessage, reason, Date.now());
    return info.lastInsertRowid;
}

export function listReports({ status = 'open', limit = 100, offset = 0 } = {}) {
    return db.prepare(`
        SELECT r.*, rp.username AS reporter_name, tp.username AS target_name
        FROM report r
        LEFT JOIN players rp ON rp.player_id = r.reporter_id
        LEFT JOIN players tp ON tp.player_id = r.target_player_id
        WHERE (? = 'all' OR r.status = ?)
        ORDER BY r.id DESC LIMIT ? OFFSET ?
    `).all(status, status, limit, offset);
}

export function resolveReport(reportId, { resolvedBy = null, resolution = null, status = 'resolved' } = {}) {
    db.prepare(`
        UPDATE report SET status = ?, resolved_by = ?, resolved_at = ?, resolution = ?
        WHERE id = ?
    `).run(status, resolvedBy, Date.now(), resolution, reportId);
}

// ---------- Chat filter ----------

// Retorna a mensagem mascarada se algum pattern bater; null = liberada.
export function filterChatMessage(message) {
    const rules = db.prepare('SELECT pattern, action FROM chat_filter_rule').all();
    for (const rule of rules) {
        let re;
        try { re = new RegExp(rule.pattern, 'i'); } catch { continue; }
        if (re.test(message)) {
            if (rule.action === 'block') return { blocked: true };
            return { blocked: false, masked: message.replace(re, (m) => '*'.repeat(m.length)) };
        }
    }
    return null;
}

export function addFilterRule(pattern, { createdBy = null, action = 'mask' } = {}) {
    const info = db.prepare(`
        INSERT INTO chat_filter_rule (pattern, action, created_by, created_at)
        VALUES (?, ?, ?, ?)
    `).run(pattern, action, createdBy, Date.now());
    return info.lastInsertRowid;
}

export function removeFilterRule(id) {
    db.prepare('DELETE FROM chat_filter_rule WHERE id = ?').run(id);
}

export function listFilterRules() {
    return db.prepare(`
        SELECT f.*, p.username AS created_by_name FROM chat_filter_rule f
        LEFT JOIN players p ON p.player_id = f.created_by
        ORDER BY f.id
    `).all();
}

// ---------- Login history / audit ----------

export function recordLogin({ playerId = null, username = null, ip = null, userAgent = null, success }) {
    db.prepare(`
        INSERT INTO login_history (player_id, username, ip, user_agent, success, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(playerId, username, ip, userAgent, success ? 1 : 0, Date.now());
}

export function listLoginHistory(playerId, limit = 50) {
    return db.prepare(`
        SELECT * FROM login_history WHERE player_id = ?
        ORDER BY id DESC LIMIT ?
    `).all(playerId, limit);
}

export function audit(actorId, action, targetId = null, details = null) {
    db.prepare(`
        INSERT INTO audit_log (actor_id, action, target_id, details, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(actorId, action, targetId, details ? JSON.stringify(details) : null, Date.now());
}

export function listAuditLog(limit = 100, offset = 0) {
    return db.prepare(`
        SELECT a.*, p.username AS actor_name FROM audit_log a
        LEFT JOIN players p ON p.player_id = a.actor_id
        ORDER BY a.id DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
}
