/**
 * auth.js - Identificação de jogadores sem login
 * Estratégia: cookie HttpOnly -> localStorage token -> IP fallback
 */

import crypto from 'crypto';
import playerStore from './playerStore.js';
import { clientIp, isLoopbackIp } from './net.js';

const COOKIE_NAME = 'penguin_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 dias

/**
 * Extrai o session token do cookie ou de um query param (para localStorage fallback)
 */
function extractSessionToken(req) {
    // 1. Tenta cookie
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, c) => {
            const [key, val] = c.trim().split('=');
            acc[key] = val;
            return acc;
        }, {});
        if (cookies[COOKIE_NAME]) {
            return cookies[COOKIE_NAME];
        }
    }

    // 2. Tenta query param (o cliente pode enviar o token do localStorage aqui)
    // O WebSocket não tem query params fáceis, então o cliente pode enviar no primeiro pacote
    // Por enquanto, retornamos null e o cliente envia via mensagem
    return null;
}

/**
 * Identifica ou cria um jogador baseado na requisição
 * Retorna { player, isNew, sessionToken }
 */
export function identifyPlayer(req, clientToken = null) {
    const ip = clientIp(req) || 'unknown';

    // 1. Tenta por session token (cookie ou localStorage)
    const sessionToken = clientToken || extractSessionToken(req);
    if (sessionToken) {
        const player = playerStore.getPlayerBySession(sessionToken);
        if (player) {
            playerStore.touchPlayer(player.player_id);
            return { player, isNew: false, sessionToken };
        }
    }

    // 2. Tenta por IP (fallback) — ignorado em localhost para permitir
    // varios pinguins de teste na mesma maquina (todos compartilham ::1)
    const isLoopback = isLoopbackIp(ip);
    const playerByIp = isLoopback ? null : playerStore.getPlayerByIp(ip);
    if (playerByIp) {
        // Se encontrou por IP mas não tem token, gera um novo
        const newToken = crypto.randomBytes(32).toString('hex');
        playerStore.updatePlayerSession(playerByIp.player_id, newToken);
        playerStore.touchPlayer(playerByIp.player_id);
        const updated = playerStore.getPlayerById(playerByIp.player_id);
        return { player: updated, isNew: false, sessionToken: newToken };
    }

    // 3. Nenhum jogador encontrado - precisa criar
    return { player: null, isNew: true, sessionToken: null, ip };
}

/**
 * Cria um novo jogador e retorna o session token
 */
export function createNewPlayer(ip, username, colorItemId = 1) {
    const player = playerStore.createPlayer(ip, username, colorItemId);
    const sessionToken = player.session_token;
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

export default {
    identifyPlayer,
    createNewPlayer,
    buildSessionCookie,
    applyDailyBonusIfNeeded,
    COOKIE_NAME
};
