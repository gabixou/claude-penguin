/**
 * admin.js - API HTTP de administração (painel de moderação).
 *
 * - POST /api/login            { username, password } -> { token, player }
 * - Demais rotas exigem `Authorization: Bearer <sessionToken>` de um
 *   jogador com role >= moderator. Ações sensíveis (papel, filtros
 *   administrativos) exigem admin.
 * - GET /admin                 painel web estático (mesma origem).
 *
 * `setHooks()` permite ao index.js injetar ações que dependem do estado
 * WebSocket em memória (derrubar jogador online, notificar ban).
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import * as accounts from './accounts.js';
import * as mod from './moderation.js';
import playerStore from './playerStore.js';
import catalog from './catalog.js';
import { WORLD_ID } from './worlds.js';
import * as parties from './parties.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PANEL_PATH = path.join(__dirname, '..', 'admin-panel.html');

// Hooks injetados pelo index.js (estado em memória do WS)
const hooks = {
    kickOnline: null,   // (playerId, code, message) => void
    liveStats: null,    // () => { online, rooms, connections }
};

export function setHooks(h) {
    Object.assign(hooks, h || {});
}

// ---------- helpers HTTP ----------

function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    });
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > 64 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => {
            if (!chunks.length) return resolve({});
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch { reject(new Error('invalid JSON')); }
        });
        req.on('error', reject);
    });
}

// Autentica o Bearer token -> { player, sessionRow } ou envia erro e retorna null
function authAdmin(req, res, minRole = mod.ROLES.MODERATOR) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const resolved = token && accounts.resolveSession(token);
    if (!resolved) {
        sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Token de sessão inválido ou expirado' });
        return null;
    }
    const player = playerStore.getPlayerById(resolved.playerId);
    if (!player) {
        sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Jogador não encontrado' });
        return null;
    }
    const ban = mod.activeBan(player.player_id);
    if (ban) {
        sendJson(res, 403, { error: 'BANNED', message: 'Conta banida' });
        return null;
    }
    if (!mod.hasRole(player, minRole)) {
        sendJson(res, 403, { error: 'FORBIDDEN', message: `Requer role >= ${minRole}` });
        return null;
    }
    return { player, session: resolved.session };
}

function audit(actorId, action, targetId, details) {
    mod.audit(actorId, `admin.${action}`, targetId, details);
}

function applyBanToOnline(playerId) {
    if (hooks.kickOnline) hooks.kickOnline(playerId, 'BANNED', 'Conta banida');
}

// ---------- rotas ----------

async function handleApi(req, res, url) {
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
    const route = parts.slice(1);

    // ---------- endpoints públicos (monitoramento) ----------
    if (req.method === 'GET' && route[0] === 'health') {
        const live = hooks.liveStats ? hooks.liveStats() : {};
        sendJson(res, 200, {
            ok: true,
            uptimeSec: Math.round(process.uptime()),
            worlds: db.prepare('SELECT id, name, online, capacity FROM worlds').all(),
            ...live,
        });
        return;
    }
    if (req.method === 'GET' && route[0] === 'metrics') {
        const live = hooks.liveStats ? hooks.liveStats() : {};
        sendJson(res, 200, {
            players: db.prepare('SELECT COUNT(*) n FROM players').get().n,
            sessions: db.prepare('SELECT COUNT(*) n FROM sessions WHERE expires_at > ?').get(Date.now()).n,
            openReports: db.prepare("SELECT COUNT(*) n FROM report WHERE status = 'open'").get().n,
            activeBans: db.prepare('SELECT COUNT(*) n FROM ban WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)').get(Date.now()).n,
            ...live,
        });
        return;
    }

    // Login próprio do painel (moderator+)
    if (req.method === 'POST' && route[0] === 'login' && route.length === 1) {
        const body = await readBody(req);
        const username = accounts.normalizeUsername(body.username);
        const ip = req.socket.remoteAddress || null;
        const key = accounts.usernameKey(username);
        if (!accounts.authAttemptAllowed('account', `admin:${key}`) ||
            !accounts.authAttemptAllowed('ip', `admin:${ip}`)) {
            sendJson(res, 429, { error: 'RATE_LIMITED', message: 'Muitas tentativas. Tente mais tarde.' });
            return;
        }
        const player = playerStore.getPlayerByUsername(username);
        const ok = player && accounts.verifyPassword(body.password, playerStore.getPasswordHash(player.player_id));
        if (!ok) {
            sendJson(res, 401, { error: 'INVALID_CREDENTIALS', message: 'Usuário ou senha inválidos' });
            return;
        }
        if (!mod.hasRole(player, mod.ROLES.MODERATOR)) {
            sendJson(res, 403, { error: 'FORBIDDEN', message: 'Apenas moderadores e administradores' });
            return;
        }
        if (mod.activeBan(player.player_id)) {
            sendJson(res, 403, { error: 'BANNED', message: 'Conta banida' });
            return;
        }
        accounts.authAttemptSucceeded('account', `admin:${key}`);
        accounts.authAttemptSucceeded('ip', `admin:${ip}`);
        const token = accounts.createSession(player.player_id, ip, req.headers['user-agent'], WORLD_ID);
        mod.recordLogin({ playerId: player.player_id, username, ip, userAgent: req.headers['user-agent'], success: true });
        sendJson(res, 200, {
            token,
            player: {
                playerId: player.player_id,
                username: player.username,
                role: player.role,
            },
        });
        return;
    }

    // A partir daqui exige Bearer token de moderator+
    const auth_ = authAdmin(req, res);
    if (!auth_) return;
    const { player: me } = auth_;

    // GET /api/me
    if (req.method === 'GET' && route[0] === 'me') {
        sendJson(res, 200, { playerId: me.player_id, username: me.username, role: me.role });
        return;
    }

    // GET /api/stats
    if (req.method === 'GET' && route[0] === 'stats') {
        const count = (sql, ...args) => db.prepare(sql).get(...args).n;
        sendJson(res, 200, {
            players: count('SELECT COUNT(*) n FROM players'),
            onlineHint: count('SELECT COUNT(*) n FROM sessions WHERE expires_at > ?', Date.now()),
            openReports: count("SELECT COUNT(*) n FROM report WHERE status = 'open'"),
            activeBans: count('SELECT COUNT(*) n FROM ban WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)', Date.now()),
            auditEntries: count('SELECT COUNT(*) n FROM audit_log'),
        });
        return;
    }

    // GET /api/players?q=
    if (req.method === 'GET' && route[0] === 'players' && route.length === 1) {
        const q = url.searchParams.get('q') || '';
        sendJson(res, 200, { players: playerStore.searchPlayers(q, 50) });
        return;
    }

    // /api/players/:id...
    if (route[0] === 'players' && route[1]) {
        const targetId = decodeURIComponent(route[1]);
        const target = playerStore.getPlayerById(targetId);
        if (!target) { sendJson(res, 404, { error: 'NOT_FOUND', message: 'Jogador não encontrado' }); return; }
        const sub = route[2];

        if (req.method === 'GET' && !sub) {
            const ban = mod.activeBan(target.player_id);
            sendJson(res, 200, {
                player: playerStore.getPlayerSummary(target.player_id),
                equipped: playerStore.getEquipped(target.player_id),
                inventoryCount: playerStore.getInventory(target.player_id).length,
                activeBan: ban,
                mutedUntil: target.muted_until || null,
            });
            return;
        }

        const body = req.method === 'POST' ? await readBody(req) : {};

        // Ações destrutivas não podem mirar o próprio admin
        const SELF_BLOCKED = new Set(['ban', 'kick', 'mute', 'unmute', 'password', 'recovery', 'role', 'coins', 'name', 'items', 'all-items']);
        if (SELF_BLOCKED.has(sub) && target.player_id === me.player_id) {
            sendJson(res, 400, { error: 'INVALID_DATA', message: 'Você não pode aplicar esta ação em si mesmo' });
            return;
        }

        // POST /api/players/:id/coins { coins } ou { amount }
        if (req.method === 'POST' && sub === 'coins') {
            const delta = Number.isFinite(Number(body.amount)) ? Number(body.amount) : null;
            if (delta !== null) {
                playerStore.addCoins(target.player_id, Math.trunc(delta));
            } else if (Number.isFinite(Number(body.coins)) && Number(body.coins) >= 0) {
                playerStore.updatePlayerCoins(target.player_id, Math.trunc(Number(body.coins)));
            } else {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'Informe coins (absoluto) ou amount (delta)' });
                return;
            }
            audit(me.player_id, 'coins', target.player_id, body);
            sendJson(res, 200, { ok: true, coins: playerStore.getPlayerSummary(target.player_id).coins });
            return;
        }

        // POST /api/players/:id/items { action: grant|remove, itemId, quantity }
        if (req.method === 'POST' && sub === 'items') {
            const itemId = Number(body.itemId);
            const qty = Math.max(1, Math.min(999, Math.trunc(Number(body.quantity) || 1)));
            if (!Number.isInteger(itemId) || itemId <= 0) {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'itemId inválido' });
                return;
            }
            if (body.action === 'remove') {
                playerStore.removeItem(target.player_id, itemId, qty);
            } else {
                playerStore.grantItem(target.player_id, itemId, qty);
            }
            audit(me.player_id, body.action === 'remove' ? 'item.remove' : 'item.grant', target.player_id, { itemId, quantity: qty });
            sendJson(res, 200, { ok: true });
            return;
        }

        // POST /api/players/:id/all-items { enabled }
        if (req.method === 'POST' && sub === 'all-items') {
            playerStore.setAllItems(target.player_id, body.enabled ? 1 : 0);
            audit(me.player_id, 'all_items', target.player_id, { enabled: !!body.enabled });
            sendJson(res, 200, { ok: true });
            return;
        }

        // POST /api/players/:id/name { username }
        if (req.method === 'POST' && sub === 'name') {
            const username = accounts.normalizeUsername(body.username);
            if (!accounts.isValidUsername(username)) {
                sendJson(res, 400, { error: 'INVALID_USERNAME', message: 'Nome inválido' });
                return;
            }
            const existing = playerStore.getPlayerByUsernameKey(accounts.usernameKey(username));
            if (existing && existing.player_id !== target.player_id) {
                sendJson(res, 409, { error: 'USERNAME_TAKEN', message: 'Nome já em uso' });
                return;
            }
            const oldName = target.username;
            playerStore.setPlayerUsername(target.player_id, username);
            playerStore.renamePlayer(target.player_id, username); // name_changed_at
            audit(me.player_id, 'rename', target.player_id, { from: oldName, to: username });
            sendJson(res, 200, { ok: true, username });
            return;
        }

        // POST /api/players/:id/ban { reason, minutes }
        if (req.method === 'POST' && sub === 'ban') {
            const minutes = body.minutes ? Math.min(Number(body.minutes), 60 * 24 * 365) : null;
            const durationMs = minutes ? minutes * 60000 : null;
            mod.banPlayer(target.player_id, { reason: body.reason || null, moderatorId: me.player_id, durationMs });
            accounts.revokeAllSessions(target.player_id);
            applyBanToOnline(target.player_id);
            audit(me.player_id, 'ban', target.player_id, { reason: body.reason, minutes });
            sendJson(res, 200, { ok: true });
            return;
        }

        // POST /api/players/:id/unban
        if (req.method === 'POST' && sub === 'unban') {
            mod.unbanPlayerActive(target.player_id, me.player_id);
            audit(me.player_id, 'unban', target.player_id, {});
            sendJson(res, 200, { ok: true });
            return;
        }

        // POST /api/players/:id/mute { minutes } | unmute
        if (req.method === 'POST' && (sub === 'mute' || sub === 'unmute')) {
            const until = sub === 'mute' ? Date.now() + Math.max(1, Math.min(1440, Number(body.minutes) || 10)) * 60000 : null;
            mod.setMutedUntil(target.player_id, until);
            audit(me.player_id, sub, target.player_id, { minutes: body.minutes });
            sendJson(res, 200, { ok: true, mutedUntil: until });
            return;
        }

        // POST /api/players/:id/kick
        if (req.method === 'POST' && sub === 'kick') {
            if (hooks.kickOnline) hooks.kickOnline(target.player_id, 'KICKED', body.reason || 'Expulso pela administração');
            audit(me.player_id, 'kick', target.player_id, { reason: body.reason });
            sendJson(res, 200, { ok: true });
            return;
        }

        // POST /api/players/:id/role { role } — somente admin
        if (req.method === 'POST' && sub === 'role') {
            if (!mod.hasRole(me, mod.ROLES.ADMIN)) {
                sendJson(res, 403, { error: 'FORBIDDEN', message: 'Apenas administradores' });
                return;
            }
            const newRole = String(body.role || '');
            if (!Object.values(mod.ROLES).includes(newRole)) {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'Role inválida' });
                return;
            }
            if (target.player_id === me.player_id && newRole !== 'admin') {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'Você não pode rebaixar a si mesmo' });
                return;
            }
            playerStore.setRole(target.player_id, newRole);
            audit(me.player_id, 'set_role', target.player_id, { role: newRole });
            sendJson(res, 200, { ok: true, role: newRole });
            return;
        }

        // POST /api/players/:id/password { password } — redefine senha e revoga sessões
        if (req.method === 'POST' && sub === 'password') {
            if (!accounts.isValidPassword(body.password)) {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'Senha deve ter 6-72 caracteres' });
                return;
            }
            playerStore.resetPassword(target.player_id, accounts.hashPassword(body.password));
            accounts.revokeAllSessions(target.player_id);
            audit(me.player_id, 'reset_password', target.player_id, {});
            sendJson(res, 200, { ok: true });
            return;
        }

        // POST /api/players/:id/recovery — gera novo código de recuperação (mostrado 1x)
        if (req.method === 'POST' && sub === 'recovery') {
            const code = accounts.generateRecoveryCode();
            const label = `Claude Penguin - ${target.username}`;
            playerStore.setRecoveryCode(target.player_id, accounts.hashRecoveryCode(code), label);
            accounts.revokeAllSessions(target.player_id);
            audit(me.player_id, 'reset_recovery', target.player_id, {});
            sendJson(res, 200, { ok: true, recoveryCode: code, recoveryLabel: label });
            return;
        }

        // GET /api/players/:id/logins
        if (req.method === 'GET' && sub === 'logins') {
            sendJson(res, 200, { logins: mod.listLoginHistory(target.player_id, 50) });
            return;
        }

        // GET /api/players/:id/warnings
        if (req.method === 'GET' && sub === 'warnings') {
            sendJson(res, 200, { warnings: mod.listWarnings(target.player_id) });
            return;
        }

        // GET /api/players/:id/inventory
        if (req.method === 'GET' && sub === 'inventory') {
            sendJson(res, 200, { inventory: playerStore.getInventory(target.player_id) });
            return;
        }
    }

    // GET /api/reports?status=open|resolved|all
    if (req.method === 'GET' && route[0] === 'reports' && route.length === 1) {
        const status = url.searchParams.get('status') || 'open';
        sendJson(res, 200, { reports: mod.listReports({ status, limit: 200 }) });
        return;
    }

    // POST /api/reports/:id { status, resolution }
    if (req.method === 'POST' && route[0] === 'reports' && route[1]) {
        const id = Number(route[1]);
        const body = await readBody(req);
        const status = ['resolved', 'dismissed', 'open'].includes(body.status) ? body.status : 'resolved';
        mod.resolveReport(id, { resolvedBy: me.player_id, resolution: body.resolution || null, status });
        audit(me.player_id, 'report.resolve', id, { status });
        sendJson(res, 200, { ok: true });
        return;
    }

    // /api/filters — regras do filtro de chat
    if (route[0] === 'filters') {
        if (req.method === 'GET' && route.length === 1) {
            sendJson(res, 200, { rules: mod.listFilterRules() });
            return;
        }
        if (req.method === 'POST' && route.length === 1) {
            const body = await readBody(req);
            const pattern = String(body.pattern || '').trim();
            if (!pattern || pattern.length > 200) {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'Padrão inválido' });
                return;
            }
            try { new RegExp(pattern, 'i'); } catch {
                sendJson(res, 400, { error: 'INVALID_REGEX', message: 'Expressão regular inválida' });
                return;
            }
            const id = mod.addFilterRule(pattern, { createdBy: me.player_id, action: body.action === 'block' ? 'block' : 'mask' });
            audit(me.player_id, 'filter.add', id, { pattern, action: body.action });
            sendJson(res, 200, { ok: true, id });
            return;
        }
        if (req.method === 'DELETE' && route[1]) {
            mod.removeFilterRule(Number(route[1]));
            audit(me.player_id, 'filter.remove', Number(route[1]), {});
            sendJson(res, 200, { ok: true });
            return;
        }
    }

    // GET /api/bans?status=active|all
    if (req.method === 'GET' && route[0] === 'bans') {
        const status = url.searchParams.get('status') || 'active';
        sendJson(res, 200, { bans: mod.listBans({ status, limit: 200 }) });
        return;
    }

    // GET /api/audit?limit&offset
    if (req.method === 'GET' && route[0] === 'audit') {
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100));
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        sendJson(res, 200, { audit: mod.listAuditLog(limit, offset) });
        return;
    }

    // GET /api/catalog — itens do catálogo (para o painel conceder itens)
    if (req.method === 'GET' && route[0] === 'catalog') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const items = catalog.isLoaded() ? catalog.searchItems(q, 50) : [];
        sendJson(res, 200, { items, catalogLoaded: catalog.isLoaded() });
        return;
    }

    // ---------- códigos de resgate (Fase 6) ----------
    if (route[0] === 'redeem-codes') {
        if (req.method === 'GET' && route.length === 1) {
            const codes = db.prepare(`
                SELECT c.*, p.username AS created_by_name FROM redeem_codes c
                LEFT JOIN players p ON p.player_id = c.created_by ORDER BY c.created_at DESC LIMIT 200
            `).all();
            sendJson(res, 200, { codes });
            return;
        }
        if (req.method === 'POST' && route.length === 1) {
            const body = await readBody(req);
            const code = String(body.code || '').trim().toUpperCase().replace(/\s+/g, '');
            if (code.length < 4 || code.length > 40) {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'Código deve ter 4-40 caracteres' });
                return;
            }
            const rewardType = ['coins', 'item'].includes(body.rewardType) ? body.rewardType : null;
            if (!rewardType) { sendJson(res, 400, { error: 'INVALID_DATA', message: 'rewardType: coins|item' }); return; }
            db.prepare(`
                INSERT INTO redeem_codes (code, reward_type, reward_id, quantity, max_uses, expires_at, created_at, created_by)
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT(code) DO UPDATE SET reward_type=excluded.reward_type, reward_id=excluded.reward_id,
                    quantity=excluded.quantity, max_uses=excluded.max_uses, expires_at=excluded.expires_at
            `).run(code, rewardType, Number(body.rewardId) || (rewardType === 'coins' ? 1 : null),
                Math.max(1, Math.min(999, Math.trunc(Number(body.quantity) || 1))),
                body.maxUses ? Math.trunc(Number(body.maxUses)) : null,
                body.expiresAt ? Number(body.expiresAt) : null, Date.now(), me.player_id);
            audit(me.player_id, 'redeem.create', code, body);
            sendJson(res, 200, { ok: true });
            return;
        }
        if (req.method === 'DELETE' && route[1]) {
            db.prepare('DELETE FROM redeem_codes WHERE code = ?').run(decodeURIComponent(route[1]));
            audit(me.player_id, 'redeem.delete', decodeURIComponent(route[1]), {});
            sendJson(res, 200, { ok: true });
            return;
        }
    }

    // ---------- festas (Fase 8) ----------
    if (route[0] === 'parties') {
        // GET /api/parties?at=<ms> — lista + ativa agora + preview no instante
        if (req.method === 'GET' && route.length === 1) {
            const at = Number(url.searchParams.get('at')) || null;
            const active = parties.activeParty();
            sendJson(res, 200, {
                parties: parties.listParties(),
                active: parties.partyClientData(active),
                preview: at ? parties.partyClientData(parties.previewParty(at)) : null,
            });
            return;
        }
        // POST /api/parties — agendar { name, startAt, endAt, timezone }
        if (req.method === 'POST' && route.length === 1) {
            const body = await readBody(req);
            const name = String(body.name || '').trim();
            const startAt = Number(body.startAt), endAt = Number(body.endAt);
            if (!name || !Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
                sendJson(res, 400, { error: 'INVALID_DATA', message: 'name, startAt e endAt (end>start) obrigatórios' });
                return;
            }
            const id = parties.createParty({ name, startAt, endAt, timezone: body.timezone || null, createdBy: me.player_id });
            audit(me.player_id, 'party.create', id, { name, startAt, endAt });
            sendJson(res, 200, { ok: true, id });
            return;
        }
        if (route[1]) {
            const id = Number(route[1]);
            const party = parties.getParty(id);
            if (!party) { sendJson(res, 404, { error: 'NOT_FOUND' }); return; }
            const sub = route[2];

            // GET /api/parties/:id — detalhe + substituições
            if (req.method === 'GET' && !sub) {
                sendJson(res, 200, {
                    party,
                    substitutions: parties.listSubstitutions(id),
                    clientData: parties.partyClientData(party),
                });
                return;
            }
            // POST /api/parties/:id — atualizar campos { name?, startAt?, endAt?, timezone?, status? }
            if (req.method === 'POST' && !sub) {
                const body = await readBody(req);
                parties.updateParty(id, body);
                audit(me.player_id, 'party.update', id, body);
                sendJson(res, 200, { ok: true, party: parties.getParty(id) });
                return;
            }
            // POST /api/parties/:id/activate { durationMin? } — ativa agora
            if (req.method === 'POST' && sub === 'activate') {
                const body = await readBody(req).catch(() => ({}));
                const dur = Math.min(30 * 24 * 60, Math.max(5, Number(body.durationMin) || 60)) * 60000;
                const nowTs = Date.now();
                // desativa outras festas que cubram este intervalo
                db.prepare(`UPDATE parties SET end_at = MIN(end_at, ?) WHERE id != ? AND start_at < ? AND end_at > ? AND status != 'cancelled'`)
                    .run(nowTs, id, nowTs + dur, nowTs);
                parties.updateParty(id, { startAt: nowTs - 1000, endAt: nowTs + dur, status: 'active' });
                audit(me.player_id, 'party.activate', id, { durationMin: dur / 60000 });
                sendJson(res, 200, { ok: true, party: parties.getParty(id) });
                return;
            }
            // POST /api/parties/:id/substitutions { roomId?, kind, value }
            if (req.method === 'POST' && sub === 'substitutions') {
                const body = await readBody(req);
                const kind = String(body.kind || '');
                const allowed = new Set(['package', 'music', 'catalogue', 'free_items', 'extra_rooms', 'map']);
                if (!allowed.has(kind)) { sendJson(res, 400, { error: 'INVALID_DATA', message: `kind deve ser um de: ${[...allowed].join(', ')}` }); return; }
                parties.setSubstitution(id, { roomId: body.roomId || null, kind, value: body.value });
                audit(me.player_id, 'party.substitution.set', id, { roomId: body.roomId, kind });
                sendJson(res, 200, { ok: true });
                return;
            }
            // DELETE /api/parties/:id/substitutions?roomId=&kind=
            if (req.method === 'DELETE' && sub === 'substitutions') {
                const roomId = url.searchParams.get('roomId');
                const kind = url.searchParams.get('kind');
                parties.deleteSubstitution(id, roomId || null, kind);
                audit(me.player_id, 'party.substitution.delete', id, { roomId, kind });
                sendJson(res, 200, { ok: true });
                return;
            }
            // DELETE /api/parties/:id — desfazer (remove festa + subs)
            if (req.method === 'DELETE' && !sub) {
                parties.deleteParty(id);
                audit(me.player_id, 'party.delete', id, { name: party.name });
                sendJson(res, 200, { ok: true });
                return;
            }
        }
        sendJson(res, 404, { error: 'NOT_FOUND' });
        return;
    }

    // ---------- jornal (Fase 6) ----------
    if (route[0] === 'newspaper') {
        if (req.method === 'GET') {
            const news = db.prepare('SELECT * FROM newspaper ORDER BY id DESC LIMIT 100').all();
            sendJson(res, 200, { newspaper: news });
            return;
        }
        if (req.method === 'POST') {
            const body = await readBody(req);
            const title = String(body.title || '').substring(0, 120);
            const text = String(body.body || '').substring(0, 5000);
            if (!title || !text) { sendJson(res, 400, { error: 'INVALID_DATA', message: 'title e body obrigatórios' }); return; }
            const info = db.prepare('INSERT INTO newspaper (title, body, published_at) VALUES (?,?,?)')
                .run(title, text, Date.now());
            audit(me.player_id, 'newspaper.publish', info.lastInsertRowid, { title });
            sendJson(res, 200, { ok: true, id: info.lastInsertRowid });
            return;
        }
        if (req.method === 'DELETE' && route[1]) {
            db.prepare('DELETE FROM newspaper WHERE id = ?').run(Number(route[1]));
            audit(me.player_id, 'newspaper.delete', Number(route[1]), {});
            sendJson(res, 200, { ok: true });
            return;
        }
    }

    sendJson(res, 404, { error: 'NOT_FOUND', message: 'Rota desconhecida' });
}

// ---------- servidor HTTP ----------

function servePanel(req, res) {
    fs.readFile(PANEL_PATH, (err, data) => {
        if (err) { sendJson(res, 404, { error: 'NOT_FOUND' }); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
    });
}

// tls = { cert, key } opcional — com certs, sobe HTTPS/WSS na mesma porta.
export function createAdminServer(tls = null) {
    const handler = async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        try {
            if (req.method === 'OPTIONS') { sendJson(res, 204, {}); return; }
            if (url.pathname === '/admin' || url.pathname === '/admin/') { servePanel(req, res); return; }
            if (url.pathname.startsWith('/api/')) { await handleApi(req, res, url); return; }
            sendJson(res, 404, { error: 'NOT_FOUND', message: 'Use /admin ou /api/*' });
        } catch (err) {
            console.error('[admin] erro:', err.message);
            if (!res.headersSent) sendJson(res, 500, { error: 'INTERNAL', message: err.message });
        }
    };
    const server = tls?.cert && tls?.key
        ? https.createServer({ cert: tls.cert, key: tls.key }, handler)
        : http.createServer(handler);
    return server;
}
