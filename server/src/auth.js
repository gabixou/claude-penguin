/**
 * auth.js - Identificação de jogadores.
 *
 * Estratégia atual (fase 2):
 *  - sessionToken do cliente -> tabela `sessions` (contas e guests)
 *  - fallback legado: players.session_token (tokens antigos ainda
 *    válidos até o prazo de migração — ver meta.legacy_token_deadline)
 *
 * Removido: reconhecimento automático por IP (qualquer visitante ganhava
 * a conta do último jogador daquele IP).
 */

import db from './db.js';
import playerStore from './playerStore.js';
import * as accounts from './accounts.js';
import { clientIp } from './net.js';

const { legacyDeadline, legacyGraceActive } = accounts;

const COOKIE_NAME = 'penguin_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias

// Prazo para contas antigas definirem senha (gravado na migração 3).
export { legacyDeadline, legacyGraceActive };

/**
 * Resolve um session token do cliente.
 * Retorna { player, sessionToken, via } ou null.
 * `via` = 'session' (tabela sessions) | 'legacy' (players.session_token).
 */
export function resolveToken(clientToken, req = null) {
    if (!clientToken) return null;

    // 1. Sessão nova (contas e guests pós-fase-2)
    const resolved = accounts.resolveSession(clientToken);
    if (resolved) {
        const player = playerStore.getPlayerById(resolved.playerId);
        if (player) {
            playerStore.touchPlayer(player.player_id);
            return { player, sessionToken: clientToken, via: 'session' };
        }
        accounts.revokeSession(clientToken);
    }

    // 2. Token legado (players.session_token) — só até o prazo de migração
    if (Date.now() < legacyDeadline()) {
        const player = playerStore.getPlayerBySession(clientToken);
        if (player) {
            playerStore.touchPlayer(player.player_id);
            return { player, sessionToken: clientToken, via: 'legacy' };
        }
    }
    return null;
}

/**
 * Cria sessão para o jogador e devolve o token cru (vai ao cliente).
 */
export function issueSession(player, req = null) {
    const ip = req ? clientIp(req) : null;
    const ua = req?.headers?.['user-agent'] || null;
    return accounts.createSession(player.player_id, ip, ua);
}

/**
 * Identifica jogador por token; se não achar, retorna { player: null, ip }
 * para o fluxo de guest criar uma conta nova.
 */
export function identifyPlayer(req, clientToken = null) {
    const ip = clientIp(req) || 'unknown';
    const resolved = resolveToken(clientToken, req);
    if (resolved) {
        return { player: resolved.player, isNew: false, sessionToken: resolved.sessionToken, via: resolved.via };
    }
    return { player: null, isNew: true, sessionToken: null, ip };
}

/**
 * Cria um novo jogador (guest) e já emite sessão na tabela sessions.
 */
export function createNewPlayer(ip, username, colorItemId = 1, req = null) {
    const player = playerStore.createPlayer(ip, username, colorItemId);
    const sessionToken = issueSession(player, req);
    return { player, sessionToken };
}

/**
 * Gera o header Set-Cookie para o session token
 */
export function buildSessionCookie(sessionToken) {
    return `${COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

/**
 * Aplica daily bonus se ainda não foi aplicado hoje
 */
export function applyDailyBonusIfNeeded(playerId) {
    return playerStore.applyDailyBonus(playerId);
}

export { accounts };

export default {
    identifyPlayer,
    createNewPlayer,
    resolveToken,
    issueSession,
    buildSessionCookie,
    applyDailyBonusIfNeeded,
    legacyDeadline,
    COOKIE_NAME
};
