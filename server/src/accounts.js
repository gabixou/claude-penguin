/**
 * accounts.js - Contas: senha, código de recuperação, sessões e rate limit.
 *
 * - Senha: scrypt (node:crypto, sem deps) no formato scrypt$N$r$p$salt$hash
 * - Sessão: token aleatório de 32B vai ao cliente; no banco guarda-se só
 *   sha256(token). Validade 30 dias, renovada a cada uso.
 * - Recovery code: 12 caracteres agrupados XXXX-XXXX-XXXX; guardado como hash.
 */

import crypto from 'crypto';
import db from './db.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const LAST_USED_THROTTLE_MS = 60 * 1000; // não grava last_used a cada pacote

// ---------- Senha ----------

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, {
        N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
    }).toString('hex');
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
    if (!stored || typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, salt, hash] = parts;
    const calc = crypto.scryptSync(password, salt, SCRYPT.keylen, {
        N: Number(N), r: Number(r), p: Number(p),
    });
    const expected = Buffer.from(hash, 'hex');
    return calc.length === expected.length && crypto.timingSafeEqual(calc, expected);
}

export function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6 && password.length <= 72;
}

// ---------- Recovery code ----------

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRecoveryCode() {
    const bytes = crypto.randomBytes(12);
    const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
    return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export function hashRecoveryCode(code) {
    return crypto.createHash('sha256').update(String(code).replace(/-/g, '').toUpperCase()).digest('hex');
}

export function normalizeRecoveryCode(code) {
    return String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

// ---------- Meta / prazo de migração ----------

export function legacyDeadline() {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'legacy_token_deadline'").get();
    return row ? Number(row.value) : 0;
}

export function legacyGraceActive() {
    return Date.now() < legacyDeadline();
}

// ---------- Sessões ----------

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(playerId, ip = null, userAgent = null) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    db.prepare(`
        INSERT INTO sessions (token_hash, player_id, created_at, expires_at, last_used_at, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(hashToken(token), playerId, now, now + SESSION_TTL_MS, now, ip, userAgent);
    return token;
}

// Retorna { playerId, session } ou null. Renova expires_at a cada uso
// (last_used_at gravado no máximo 1x/min para não escrever a cada pacote).
export function resolveSession(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(rawToken));
    if (!row) return null;
    const now = Date.now();
    if (row.expires_at <= now) {
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
        return null;
    }
    if (now - row.last_used_at > LAST_USED_THROTTLE_MS) {
        db.prepare('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?')
            .run(now, now + SESSION_TTL_MS, row.token_hash);
    }
    return { playerId: row.player_id, session: row };
}

export function revokeSession(rawToken) {
    if (!rawToken) return;
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(rawToken));
}

export function revokeAllSessions(playerId, exceptTokenHash = null) {
    if (exceptTokenHash) {
        db.prepare('DELETE FROM sessions WHERE player_id = ? AND token_hash != ?')
            .run(playerId, exceptTokenHash);
    } else {
        db.prepare('DELETE FROM sessions WHERE player_id = ?').run(playerId);
    }
}

export function deleteExpiredSessions() {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

// ---------- Rate limit de tentativas (memória; zera no restart) ----------

// Janela deslizante: máx. `max` falhas por `windowMs` por chave.
const buckets = new Map();

export function rateLimitHit(key, max, windowMs = 10 * 60 * 1000) {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b) { b = []; buckets.set(key, b); }
    while (b.length && now - b[0] > windowMs) b.shift();
    if (b.length >= max) return true;
    b.push(now);
    return false;
}

export function rateLimitClear(key) {
    buckets.delete(key);
}

export const AUTH_LIMITS = {
    account: { max: 5, windowMs: 10 * 60 * 1000 },   // por username
    ip: { max: 20, windowMs: 10 * 60 * 1000 },       // por IP
};

// Retorna true se a tentativa deve ser bloqueada (e conta a tentativa).
export function authAttemptAllowed(kind, key) {
    const lim = AUTH_LIMITS[kind];
    return !rateLimitHit(`${kind}:${key}`, lim.max, lim.windowMs);
}

export function authAttemptFailed(kind, key) {
    // já contabilizado por authAttemptAllowed — mantido para clareza
}

export function authAttemptSucceeded(kind, key) {
    rateLimitClear(`${kind}:${key}`);
}

// ---------- Regras de nome ----------

const USERNAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 _.'-]{1,15}$/;
const USERNAME_BLOCKLIST = new Set([
    'admin', 'administrator', 'moderator', 'mod', 'staff', 'system',
    'support', 'arenovisk', 'official', 'claudepenguin', 'claudepenguin',
    'devin', 'root', 'null', 'undefined', 'guest',
]);

export function normalizeUsername(username) {
    return String(username || '').trim().replace(/\s{2,}/g, ' ');
}

export function usernameKey(username) {
    return normalizeUsername(username).toLowerCase();
}

export function isValidUsername(username) {
    const u = normalizeUsername(username);
    if (u.length < 3 || u.length > 16) return false;
    if (!USERNAME_RE.test(u)) return false;
    if (u !== u.trim()) return false;
    if (USERNAME_BLOCKLIST.has(u.toLowerCase())) return false;
    return true;
}
