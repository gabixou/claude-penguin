/**
 * index.js - Servidor WebSocket Multiplayer para Club Penguin Browser
 * Porta: 8080
 * Suporta múltiplas salas, movimentação com sincronização, chat em tempo real,
 * autenticação guest por IP/cookie e persistência SQLite.
 */

import http from 'node:http';
import fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import auth from './auth.js';
import playerStore from './playerStore.js';
import catalog from './catalog.js';
import { clientIp, isLoopbackIp } from './net.js';
import { getRoomConfig, MINIGAME_REWARDS, REWARD_MAX_PER_PACKET, REWARD_MAX_PER_MINUTE } from './rooms.js';
import * as accounts from './accounts.js';
import * as mod from './moderation.js';
import * as worlds from './worlds.js';
import * as game from './game.js';
import * as parties from './parties.js';
import log from './log.js';
import { createAdminServer, setHooks as setAdminHooks } from './admin.js';

const PORT = process.env.PORT || 8080;

// HTTPS/WSS opcional: SSL_CERT_PATH + SSL_KEY_PATH (arquivos PEM).
// Sem eles sobe HTTP/WS puro (dev local).
function loadTls() {
    const certPath = process.env.SSL_CERT_PATH;
    const keyPath = process.env.SSL_KEY_PATH;
    if (!certPath || !keyPath) return null;
    try {
        return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
    } catch (err) {
        log.error('tls.load_failed', { certPath, keyPath, error: err.message });
        return null;
    }
}
const tls = loadTls();

// Servidor HTTP único: /api/* e /admin (painel) + upgrade WebSocket.
// maxPayload: pacotes do protocolo sao JSON pequenos (<2KB); 16KB e folga
// generosa e impede flood de memoria via mensagens gigantes.
const httpServer = createAdminServer(tls);
const wss = new WebSocketServer({ server: httpServer, maxPayload: 16 * 1024 });
httpServer.on('error', (err) => {
    log.error('server.error', { error: err.message, code: err.code });
    process.exit(1);
});
httpServer.listen(PORT, () => {
    const proto = tls ? 'https/wss' : 'http/ws';
    console.log(`🐧 Servidor Club Penguin rodando na porta ${PORT} (${proto})`);
    console.log(`📡 WebSocket: ${tls ? 'wss' : 'ws'}://localhost:${PORT}`);
    console.log(`🛠️  Painel admin: http://${tls ? 's' : ''}localhost:${PORT}/admin`);
    log.info('server.started', { port: PORT, tls: !!tls, world: worlds.WORLD_ID });
});

// Rate limit simples por socket (token bucket): ~30 pacotes/s em media,
// burst de 60 — suficiente para jogo normal, bloqueia spam/flood.
const RATE_LIMIT = { rate: 30, burst: 60 };
function allowPacket(ws) {
    const now = Date.now();
    let b = ws._rl;
    if (!b) { b = ws._rl = { tokens: RATE_LIMIT.burst, ts: now }; }
    b.tokens = Math.min(RATE_LIMIT.burst, b.tokens + ((now - b.ts) / 1000) * RATE_LIMIT.rate);
    b.ts = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
}

// Estado das salas em memória: { roomId: Map<playerId, playerObject> }
const rooms = new Map();
// Mapeamento de socket para dados do jogador
const clientSessions = new Map();
// Mapeamento de socket para dados persistentes do jogador (playerData)
const clientPlayerData = new Map();

// Jogadores autenticados com socket aberto — base da lotação do mundo
// e do heartbeat em worlds.online.
function onlineCount() {
    let n = 0;
    for (const ws of clientPlayerData.keys()) {
        if (ws.readyState === WebSocket.OPEN) n++;
    }
    return n;
}

function worldFull() {
    return onlineCount() >= worlds.WORLD_CAPACITY;
}

// Ops que consomem vaga no mundo — bloqueadas quando o mundo está cheio
const AUTH_OPS = new Set([
    'AUTH_GUEST', 'LOGIN', 'REGISTER', 'CLAIM_ACCOUNT',
    'LOGIN_PLAYER', 'SET_PASSWORD', 'RECOVER',
]);

const PAPERDOLL_SLOTS = ['feet', 'body', 'neck', 'hand', 'face', 'head'];
// flag/photo = cosméticos do player card (pin/bandeira e fundo) — persistem
// em `equipped` junto com o paperdoll, mas nao entram no paperdoll da sala
const EQUIP_SLOTS = [...PAPERDOLL_SLOTS, 'flag', 'photo'];

// itemId numerico (catalogo gopenguin /data/items.json) — o slot e definido
// pelo cliente na hora de equipar; aqui so validamos que e um id plausivel.
const MAX_ITEM_ID = 99999;

function emptyPaperdoll() {
    return { feet: null, body: null, neck: null, hand: null, face: null, head: null };
}

function sanitizePaperdoll(raw) {
    const outfit = emptyPaperdoll();
    if (!raw || typeof raw !== 'object') return outfit;
    for (const slot of PAPERDOLL_SLOTS) {
        const itemId = raw[slot];
        const n = Number(itemId);
        outfit[slot] = Number.isInteger(n) && n > 0 && n <= MAX_ITEM_ID ? n : null;
    }
    return outfit;
}

function publicPlayer(player) {
    return {
        playerId: player.playerId,
        username: player.username || player.playerId,
        x: player.x,
        y: player.y,
        color: player.color,
        colorItemId: player.colorItemId,
        paperdoll: player.paperdoll,
        action: player.action || null
    };
}

function sendPlayerData(ws, playerData, sessionToken = null) {
    const data = { ...playerData };
    if (sessionToken) {
        data.sessionToken = sessionToken; // para localStorage fallback
    }
    // Festa ativa (relógio do servidor) — pacote de sala, música etc.
    data.party = parties.partyClientData(parties.activeParty());
    ws.send(JSON.stringify({
        op: 'PLAYER_DATA',
        data
    }));
}

function sendError(ws, code, message) {
    ws.send(JSON.stringify({
        op: 'ERROR',
        data: { code, message }
    }));
}

function getRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
    }
    return rooms.get(roomId);
}

function broadcastToRoom(roomId, message, excludeSocket = null) {
    const room = rooms.get(roomId);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const [playerId, player] of room.entries()) {
        if (player.socket !== excludeSocket && player.socket.readyState === WebSocket.OPEN) {
            player.socket.send(payload);
        }
    }
}

wss.on('connection', (ws, req) => {
    const ip = clientIp(req);
    console.log(`[+] Nova conexão estabelecida de ${ip}`);
    log.info('ws.connect', { ip, world: worlds.WORLD_ID });

    ws.on('message', (raw) => {
        try {
            if (!allowPacket(ws)) {
                if (!ws._rlWarned) { ws._rlWarned = true; console.warn('[-] Rate limit em', ip); }
                return;
            }
            const packet = JSON.parse(raw.toString());
            handlePacket(ws, req, packet);
        } catch (err) {
            console.error('[-] Erro ao processar mensagem JSON:', err);
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });

    ws.on('error', (err) => {
        console.error('[-] Erro no WebSocket:', err);
        handleDisconnect(ws);
    });
});

// Arenovisk: pinguim de teste do dono do PC. Criado sob demanda via
// LOGIN_PLAYER (somente loopback); a flag all_items faz hasItem/
// getInventory cobrir o catalogo inteiro e coins generosas.
const ARENOVISK_NAME = 'Arenovisk';
const ARENOVISK_COINS = 100000;
function ensureArenovisk(ip) {
    let player = playerStore.getPlayerByUsername(ARENOVISK_NAME);
    if (!player) {
        player = playerStore.createPlayer(ip, ARENOVISK_NAME, 1);
        console.log(`[ARENOVISK] Pinguim de teste '${ARENOVISK_NAME}' criado`);
    }
    if (!player.all_items) {
        playerStore.setAllItems(player.player_id, 1);
        playerStore.updateCoins(player.player_id, ARENOVISK_COINS);
        player = playerStore.getPlayerById(player.player_id);
    }
    return player;
}

// Banimento ativo? Retorna o ban ou null. Usado no login e a cada entrada
// em sala (cobre bans aplicados com o jogador online).
function activeBanFor(playerId) {
    return mod.activeBan(playerId);
}

function banErrorData(ban) {
    const until = ban.expires_at ? new Date(ban.expires_at).toISOString() : null;
    return {
        code: 'BANNED',
        message: `Conta banida${ban.reason ? `: ${ban.reason}` : ''}${until ? ` (até ${until})` : ' (permanente)'}`
    };
}

// Envia PLAYER_DATA com flags de conta + checa banimento
function sendPlayerSessionChecked(ws, req, player, sessionToken) {
    const ban = activeBanFor(player.player_id);
    if (ban) {
        sendError(ws, banErrorData(ban).code, banErrorData(ban).message);
        return null;
    }
    return sendPlayerSession(ws, player, sessionToken);
}

// Acha o socket de um jogador online (para ações de moderação)
function findSocketByPlayerId(playerId) {
    for (const [ws, s] of clientPlayerData.entries()) {
        if (s.playerId === playerId) return ws;
    }
    return null;
}

// Moderador ou admin? (player = linha hidratada com .role)
function isModerator(player) {
    return mod.hasRole(player, mod.ROLES.MODERATOR);
}

// API admin -> derruba jogador online (kick/ban pelo painel HTTP)
// e expõe estatísticas ao vivo para /api/health e /api/metrics.
setAdminHooks({
    kickOnline(playerId, code, message) {
        const targetWs = findSocketByPlayerId(playerId);
        if (!targetWs) return;
        try { sendError(targetWs, code, message); } catch { /* socket já morto */ }
        handleDisconnect(targetWs, false);
        targetWs.close();
    },
    liveStats() {
        return {
            online: onlineCount(),
            connections: clientPlayerData.size,
            rooms: rooms.size,
            capacity: worlds.WORLD_CAPACITY,
            world: worlds.WORLD_ID,
        };
    },
});

// Heartbeat: mantém worlds.online atualizado no banco compartilhado
worlds.startHeartbeat(onlineCount);

// Sistemas de jogo: lookup de socket para notificações entre jogadores
game.setGameHooks({
    getSocket: (playerId) => findSocketByPlayerId(playerId),
});

// Virada de festa: quando a festa ativa muda (relógio do servidor),
// avisa todos os jogadores autenticados com PARTY_UPDATE.
let lastPartyId = parties.activeParty()?.id ?? null;
setInterval(() => {
    const cur = parties.activeParty();
    const curId = cur?.id ?? null;
    if (curId === lastPartyId) return;
    lastPartyId = curId;
    const payload = JSON.stringify({ op: 'PARTY_UPDATE', data: { party: parties.partyClientData(cur) } });
    for (const ws of clientPlayerData.keys()) {
        if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
    log.info('party.changed', { party: cur?.name || null, id: curId });
}, 60 * 1000).unref?.();

// Automacao de teste (Playwright headless, scripts de QA) usa
// "HeadlessChrome" no User-Agent — nao deve herdar o Arenovisk.
function isAutomationClient(req) {
    return /headlesschrome/i.test(req?.headers?.['user-agent'] || '');
}

// Nome automatico para visitantes sem conta (estilo gopenguin.lol:
// a pessoa entra direto como pinguim e pode renomear uma vez depois)
function generateGuestName() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 25; i++) {
        let name = 'Penguin_';
        for (let j = 0; j < 4; j++) name += chars[Math.floor(Math.random() * chars.length)];
        if (!playerStore.getPlayerByUsername(name)) return name;
    }
    return `Penguin_${Date.now().toString(36).toUpperCase()}`;
}

// Aplica daily bonus, monta a sessao e envia PLAYER_DATA — fluxo comum
// tanto para jogador existente quanto para guest recem-criado.
// offerPasswordSetup: só contas legadas (sem senha, pré-fase-2) veem o
// prompt "defina sua senha" — guests novos entram direto no jogo.
function sendPlayerSession(ws, player, sessionToken, offerPasswordSetup = false) {
    const playerData = playerStore.getPublicPlayerData(player.player_id);
    const coinsBefore = playerData.coins;
    const withBonus = auth.applyDailyBonusIfNeeded(player.player_id);
    const finalData = playerStore.getPublicPlayerData(withBonus.player_id);
    const bonus = finalData.coins - coinsBefore;
    if (bonus > 0) finalData.dailyBonus = bonus;
    if (offerPasswordSetup) finalData.passwordSetupOffered = true;

    clientPlayerData.set(ws, {
        playerId: player.player_id,
        sessionToken,
        username: player.username,
        colorItemId: player.color_item_id,
        coins: finalData.coins,
        inventory: finalData.inventory,
        equipped: finalData.equipped
    });

    sendPlayerData(ws, finalData, sessionToken);
    return finalData;
}

// Emite sessão nova e envia PLAYER_DATA (+ ACCOUNT_INFO opcional com
// código de recuperação — mostrado uma única vez ao jogador).
function sendAccountSession(ws, req, player, accountInfo = null, offerPasswordSetup = false) {
    const sessionToken = auth.issueSession(player, req);
    const data = sendPlayerSession(ws, player, sessionToken, offerPasswordSetup);
    if (accountInfo) {
        ws.send(JSON.stringify({ op: 'ACCOUNT_INFO', data: accountInfo }));
    }
    return data;
}

function recoveryLabelFor(username) {
    return `Claude Penguin - ${username}`;
}

// Gera novo recovery code, persiste o hash e devolve o código cru
// (única vez que o cliente vê o valor).
function rotateRecoveryCode(playerId, username) {
    const code = accounts.generateRecoveryCode();
    const label = recoveryLabelFor(username);
    playerStore.setRecoveryCode(playerId, accounts.hashRecoveryCode(code), label);
    return { recoveryCode: code, recoveryLabel: label };
}

function handlePacket(ws, req, packet) {
    const { op, data } = packet;
    if (!op || !data) return;

    // Lista de mundos — público, funciona mesmo com o mundo cheio
    if (op === 'SERVER_LIST') {
        ws.send(JSON.stringify({ op: 'SERVER_LIST', data: { worlds: worlds.listWorlds(), current: worlds.WORLD_ID } }));
        return;
    }

    // Ops de sistemas de jogo exigem jogador autenticado
    const gameSession = clientPlayerData.get(ws);
    if (gameSession?.playerId && game.handleGameOp(ws, gameSession, packet)) {
        return;
    }

    // Lotação do mundo: novas autenticações são recusadas quando cheio
    if (AUTH_OPS.has(op) && worldFull()) {
        sendError(ws, 'WORLD_FULL', 'Este mundo está lotado. Tente outro servidor.');
        log.warn('world.full', { world: worlds.WORLD_ID, online: onlineCount() });
        return;
    }

    switch (op) {
        case 'AUTH_GUEST': {
            const ip = clientIp(req);

            // Cliente envia sessionToken do localStorage (se houver)
            const clientToken = data.sessionToken || null;
            const result = auth.identifyPlayer(req, clientToken);

            if (result.player) {
                if (activeBanFor(result.player.player_id)) {
                    const b = banErrorData(activeBanFor(result.player.player_id));
                    sendError(ws, b.code, b.message);
                } else {
                    // Token legado (players.session_token) = conta pré-fase-2
                    // sem senha: oferece o fluxo "defina sua senha".
                    sendPlayerSession(ws, result.player, result.sessionToken,
                        result.via === 'legacy' && !result.player.has_password);
                    console.log(`[AUTH] Jogador '${result.player.username}' (${result.player.player_id}) autenticado`);
                }
            } else if (data.guest || data.forceGuest) {
                // Guest flow: cria o pinguim na hora, sem tela de conta
                const guestName = generateGuestName();
                const created = auth.createNewPlayer(result.ip, guestName, 1, req);
                sendPlayerSession(ws, created.player, created.sessionToken);
                console.log(`[AUTH] Novo pinguim '${guestName}' (${created.player.player_id}) criado automaticamente`);
            } else {
                // Sem token e sem pedido de guest: cliente mostra tela de login
                ws.send(JSON.stringify({ op: 'NEED_AUTH', data: {} }));
            }
            break;
        }

        case 'LOGIN_PLAYER': {
            // Login por nome — SOMENTE localhost (testes). Em producao
            // qualquer um poderia sequestrar o pinguim de outro jogador.
            const ip = clientIp(req);
            const isLoopback = isLoopbackIp(ip);
            if (!isLoopback) {
                sendError(ws, 'FORBIDDEN', 'Login por nome indisponivel');
                break;
            }
            const wantName = String(data.username || '').trim();
            if (!wantName) { sendError(ws, 'INVALID_DATA', 'username obrigatorio'); break; }

            let player = playerStore.getPlayerByUsername(wantName);
            if (!player) {
                try {
                    player = playerStore.createPlayer(ip, wantName, 1);
                    console.log(`[LOGIN] Novo pinguim '${wantName}' criado via LOGIN_PLAYER`);
                } catch (err) {
                    sendError(ws, 'LOGIN_FAILED', err.message);
                    break;
                }
            }
            // LOGIN_PLAYER tambem funciona para Arenovisk (garante a flag).
            if (player.username.toLowerCase() === ARENOVISK_NAME.toLowerCase()) {
                player = ensureArenovisk(ip);
            }
            const sessionToken = auth.issueSession(player, req);
            if (activeBanFor(player.player_id)) {
                const b = banErrorData(activeBanFor(player.player_id));
                sendError(ws, b.code, b.message);
            } else {
                sendPlayerSession(ws, player, sessionToken);
            }
            console.log(`[LOGIN] '${player.username}' (${player.player_id}) login por nome (allItems=${!!player.all_items})`);
            break;
        }

        case 'CREATE_PLAYER': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.isNew) {
                sendError(ws, 'INVALID_STATE', 'Não é possível criar jogador neste estado');
                return;
            }

            const { username, colorItemId = 1 } = data;
            try {
                const result = auth.createNewPlayer(session.ip, username, colorItemId, req);
                const playerData = playerStore.getPublicPlayerData(result.player.player_id);

                clientPlayerData.set(ws, {
                    playerId: result.player.player_id,
                    sessionToken: result.sessionToken,
                    username: result.player.username,
                    colorItemId: result.player.color_item_id,
                    coins: playerData.coins,
                    inventory: playerData.inventory,
                    equipped: playerData.equipped
                });

                sendPlayerData(ws, playerData, result.sessionToken);
                console.log(`[CREATE] Novo jogador '${result.player.username}' (${result.player.player_id}) criado`);
            } catch (err) {
                sendError(ws, 'CREATE_FAILED', err.message);
            }
            break;
        }

        case 'REGISTER': {
            const ip = clientIp(req);
            const username = accounts.normalizeUsername(data.username);
            const password = String(data.password || '');
            const key = accounts.usernameKey(username);

            if (!accounts.authAttemptAllowed('ip', ip) ||
                !accounts.authAttemptAllowed('account', key)) {
                sendError(ws, 'RATE_LIMITED', 'Muitas tentativas. Tente mais tarde.');
                return;
            }
            const fail = (code, msg) => sendError(ws, code, msg);
            if (!accounts.isValidUsername(username)) {
                fail('INVALID_USERNAME', 'Nome inválido (3-16 caracteres, sem caracteres especiais)');
                return;
            }
            if (!accounts.isValidPassword(password)) {
                fail('INVALID_PASSWORD', 'Senha deve ter entre 6 e 72 caracteres');
                return;
            }
            if (playerStore.getPlayerByUsernameKey(key)) {
                fail('USERNAME_TAKEN', 'Nome de usuário já está em uso');
                return;
            }

            try {
                const colorItemId = Number.isInteger(Number(data.colorItemId)) ? Number(data.colorItemId) : 1;
                const player = playerStore.createPlayer(ip, username, colorItemId);
                playerStore.setPasswordHash(player.player_id, accounts.hashPassword(password));
                const info = rotateRecoveryCode(player.player_id, player.username);
                accounts.authAttemptSucceeded('account', key);
                accounts.authAttemptSucceeded('ip', ip);
                sendAccountSession(ws, req, player, info);
                console.log(`[REGISTER] Conta '${player.username}' (${player.player_id}) criada`);
                log.info('auth.register', { playerId: player.player_id, username: player.username, ip });
            } catch (err) {
                sendError(ws, 'REGISTER_FAILED', err.message);
            }
            break;
        }

        case 'LOGIN': {
            const ip = clientIp(req);
            const username = accounts.normalizeUsername(data.username);
            const password = String(data.password || '');
            const key = accounts.usernameKey(username);

            if (!accounts.authAttemptAllowed('ip', ip) ||
                !accounts.authAttemptAllowed('account', key)) {
                sendError(ws, 'RATE_LIMITED', 'Muitas tentativas. Tente mais tarde.');
                return;
            }
            const fail = () => sendError(ws, 'INVALID_CREDENTIALS', 'Usuário ou senha incorretos');

            const player = playerStore.getPlayerByUsernameKey(key);
            if (!player) {
                mod.recordLogin({ username, ip, userAgent: req?.headers?.['user-agent'], success: false });
                fail(); return;
            }
            const stored = playerStore.getPasswordHash(player.player_id);
            if (!stored) {
                // Conta sem senha (guest/legada): oferece fluxo de claim
                sendError(ws, 'NO_PASSWORD', 'Esta conta ainda não tem senha. Use "Definir senha".');
                return;
            }
            if (!accounts.verifyPassword(password, stored)) {
                mod.recordLogin({ playerId: player.player_id, username, ip, userAgent: req?.headers?.['user-agent'], success: false });
                fail(); return;
            }
            if (activeBanFor(player.player_id)) {
                const b = banErrorData(activeBanFor(player.player_id));
                mod.recordLogin({ playerId: player.player_id, username, ip, userAgent: req?.headers?.['user-agent'], success: false });
                sendError(ws, b.code, b.message);
                return;
            }

            accounts.authAttemptSucceeded('account', key);
            accounts.authAttemptSucceeded('ip', ip);
            mod.recordLogin({ playerId: player.player_id, username, ip, userAgent: req?.headers?.['user-agent'], success: true });
            sendAccountSession(ws, req, player);
            console.log(`[LOGIN] '${player.username}' (${player.player_id}) login por senha`);
            log.info('auth.login', { playerId: player.player_id, username: player.username, ip, world: worlds.WORLD_ID });
            break;
        }

        case 'CLAIM_ACCOUNT': {
            // Migração: conta sem senha pode definir senha enquanto o prazo
            // de legado estiver ativo. Após o prazo, contas sem senha só
            // entram como guest (AUTH_GUEST) — sem acesso à conta antiga.
            const ip = clientIp(req);
            const username = accounts.normalizeUsername(data.username);
            const key = accounts.usernameKey(username);
            if (!accounts.authAttemptAllowed('ip', ip) ||
                !accounts.authAttemptAllowed('account', key)) {
                sendError(ws, 'RATE_LIMITED', 'Muitas tentativas. Tente mais tarde.');
                return;
            }
            const player = playerStore.getPlayerByUsernameKey(key);
            if (!player) {
                sendError(ws, 'INVALID_CREDENTIALS', 'Conta não encontrada');
                return;
            }
            if (playerStore.hasPassword(player.player_id)) {
                sendError(ws, 'ALREADY_HAS_PASSWORD', 'Esta conta já tem senha. Faça login.');
                return;
            }
            if (!accounts.legacyGraceActive()) {
                sendError(ws, 'MIGRATION_EXPIRED', 'Prazo para definir senha expirou');
                return;
            }
            if (activeBanFor(player.player_id)) {
                const b = banErrorData(activeBanFor(player.player_id));
                sendError(ws, b.code, b.message);
                return;
            }
            accounts.authAttemptSucceeded('account', key);
            sendAccountSession(ws, req, player, null, true);
            console.log(`[CLAIM] '${player.username}' (${player.player_id}) reivindicada para definir senha`);
            break;
        }

        case 'SET_PASSWORD': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }
            const password = String(data.password || '');
            if (!accounts.isValidPassword(password)) {
                sendError(ws, 'INVALID_PASSWORD', 'Senha deve ter entre 6 e 72 caracteres');
                return;
            }
            const player = playerStore.getPlayerById(session.playerId);
            if (!player) { sendError(ws, 'NOT_FOUND', 'Jogador não encontrado'); return; }

            playerStore.setPasswordHash(player.player_id, accounts.hashPassword(password));
            const info = rotateRecoveryCode(player.player_id, player.username);
            // Troca de senha revoga as OUTRAS sessões (a atual continua)
            const currentHash = crypto.createHash('sha256').update(session.sessionToken || '').digest('hex');
            accounts.revokeAllSessions(player.player_id, currentHash);

            const playerData = playerStore.getPublicPlayerData(player.player_id);
            session.coins = playerData.coins;
            session.inventory = playerData.inventory;
            sendPlayerData(ws, playerData, session.sessionToken);
            ws.send(JSON.stringify({ op: 'ACCOUNT_INFO', data: info }));
            console.log(`[SET_PASSWORD] '${player.username}' definiu senha`);
            break;
        }

        case 'RECOVER': {
            const ip = clientIp(req);
            const username = accounts.normalizeUsername(data.username);
            const code = accounts.normalizeRecoveryCode(data.code);
            const newPassword = String(data.newPassword || '');
            const key = accounts.usernameKey(username);

            if (!accounts.authAttemptAllowed('ip', ip) ||
                !accounts.authAttemptAllowed('account', `rec:${key}`)) {
                sendError(ws, 'RATE_LIMITED', 'Muitas tentativas. Tente mais tarde.');
                return;
            }
            const fail = () => sendError(ws, 'INVALID_RECOVERY', 'Usuário ou código inválido');

            const player = playerStore.getPlayerByUsernameKey(key);
            const stored = player ? playerStore.getRecoveryHash(player.player_id) : null;
            if (!player || !stored || stored !== accounts.hashRecoveryCode(code)) {
                fail();
                return;
            }
            if (!accounts.isValidPassword(newPassword)) {
                sendError(ws, 'INVALID_PASSWORD', 'Senha deve ter entre 6 e 72 caracteres');
                return;
            }

            mod.recordLogin({ playerId: player.player_id, username, ip, userAgent: req?.headers?.['user-agent'], success: true });
            playerStore.setPasswordHash(player.player_id, accounts.hashPassword(newPassword));
            const info = rotateRecoveryCode(player.player_id, player.username);
            accounts.revokeAllSessions(player.player_id); // derruba todos os logins
            accounts.rateLimitClear(`account:rec:${key}`);
            accounts.rateLimitClear(`account:${key}`);
            accounts.rateLimitClear(`ip:${ip}`);
            ws.send(JSON.stringify({ op: 'RECOVERY_OK', data: info }));
            console.log(`[RECOVER] '${player.username}' recuperou a conta`);
            break;
        }

        case 'LOGOUT': {
            const session = clientPlayerData.get(ws);
            if (session?.sessionToken) {
                accounts.revokeSession(session.sessionToken);
            }
            clientPlayerData.delete(ws);
            handleDisconnect(ws, false);
            ws.send(JSON.stringify({ op: 'LOGGED_OUT', data: {} }));
            console.log(`[-] Logout de ${session?.username || 'desconhecido'}`);
            break;
        }

        case 'LOAD_PLAYER': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }

            const playerData = playerStore.getPublicPlayerData(session.playerId);
            if (playerData) {
                sendPlayerData(ws, playerData, session.sessionToken);
            }
            break;
        }

        case 'DEV_GIVE': {
            // Debug local: somente loopback. {coins} absoluto ou {amount} delta.
            // Atualiza o banco e reenvia PLAYER_DATA para todos os sockets
            // do jogador — o jogo aberto em outra aba atualiza ao vivo.
            const ip = clientIp(req);
            if (!isLoopbackIp(ip)) {
                sendError(ws, 'FORBIDDEN', 'Comando disponível apenas em localhost');
                break;
            }
            const session = clientPlayerData.get(ws);
            if (!session?.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }
            const cur = playerStore.getPublicPlayerData(session.playerId);
            if (!cur) { sendError(ws, 'NOT_FOUND', 'Jogador não encontrado'); break; }
            let next;
            if (Number.isFinite(Number(data.amount))) {
                next = cur.coins + Math.trunc(Number(data.amount));
            } else if (Number.isFinite(Number(data.coins))) {
                next = Math.max(0, Math.trunc(Number(data.coins)));
            } else {
                sendError(ws, 'INVALID_DATA', 'Informe coins (absoluto) ou amount (delta)');
                break;
            }
            playerStore.updatePlayerCoins(session.playerId, next);
            const fresh = playerStore.getPublicPlayerData(session.playerId);
            for (const [sws, s] of clientPlayerData) {
                if (s.playerId !== session.playerId) continue;
                s.coins = fresh.coins;
                s.inventory = fresh.inventory;
                s.equipped = fresh.equipped;
                if (sws.readyState === WebSocket.OPEN) sendPlayerData(sws, fresh, s.sessionToken);
            }
            console.log(`[DEV_GIVE] ${session.username}: ${cur.coins} -> ${fresh.coins} coins`);
            ws.send(JSON.stringify({ op: 'DEV_OK', data: { coins: fresh.coins } }));
            break;
        }

        case 'BUY_ITEM': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }

            const { itemId } = data;
            if (!itemId) {
                sendError(ws, 'INVALID_DATA', 'itemId é obrigatório');
                return;
            }

            // Preco autoritativo do catalogo — ignora `cost` do cliente.
            // getAvailableItem respeita a vigência (validFrom/validTo).
            const item = catalog.getAvailableItem(itemId);
            if (!item) {
                sendError(ws, 'UNKNOWN_ITEM', 'Item não existe no catálogo');
                return;
            }
            if (playerStore.hasItem(session.playerId, itemId)) {
                sendError(ws, 'ALREADY_OWNED', 'Você já possui este item');
                return;
            }
            const cost = item.cost || 0;

            try {
                playerStore.buyItem(session.playerId, itemId, cost);
                const playerData = playerStore.getPublicPlayerData(session.playerId);

                // Atualiza sessão local
                session.coins = playerData.coins;
                session.inventory = playerData.inventory;

                sendPlayerData(ws, playerData, session.sessionToken);
                ws.send(JSON.stringify({
                    op: 'ITEM_BOUGHT',
                    data: { itemId, name: item.name, cost, coins: playerData.coins }
                }));
                console.log(`[BUY] ${session.username} comprou item ${itemId} (${item.name}) por ${cost} coins`);
                game.noteMission(session.playerId, 'buy_item');
            } catch (err) {
                const code = /insuficientes/i.test(err.message) ? 'INSUFFICIENT_COINS' : 'BUY_FAILED';
                sendError(ws, code, err.message);
            }
            break;
        }

        case 'MINIGAME_REWARD': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }

            // Recompensa de minigame calculada no servidor: o cliente
            // informa apenas o jogo e o nível concluído — `amount` do
            // pacote é ignorado (antes permitia farm de coins).
            const game = String(data.game || '');
            const cfg = MINIGAME_REWARDS[game];
            if (!cfg) {
                sendError(ws, 'UNKNOWN_MINIGAME', 'Minigame desconhecido');
                return;
            }
            const level = Math.floor(Number(data.level));
            if (!Number.isFinite(level) || level < 1 || level > cfg.maxLevel) {
                sendError(ws, 'INVALID_DATA', 'level inválido');
                return;
            }
            // Rate limit: máx. REWARD_MAX_PER_MINUTE recompensas por minuto
            const now = Date.now();
            const log = (session.rewardLog ||= []).filter((t) => now - t < 60_000);
            session.rewardLog = log;
            if (log.length >= REWARD_MAX_PER_MINUTE) {
                sendError(ws, 'RATE_LIMITED', 'Muitas recompensas em pouco tempo');
                return;
            }
            const reward = Math.min(level * cfg.perLevel, REWARD_MAX_PER_PACKET);
            log.push(now);
            playerStore.addCoins(session.playerId, reward);
            const playerData = playerStore.getPublicPlayerData(session.playerId);
            session.coins = playerData.coins;
            sendPlayerData(ws, playerData, session.sessionToken);
            ws.send(JSON.stringify({
                op: 'MINIGAME_REWARD',
                data: { level, reward, coins: playerData.coins }
            }));
            console.log(`[REWARD] ${session.username} concluiu level ${level} de minigame (+${reward} coins)`);
            game.noteMission(session.playerId, 'earn_coins', reward);
            break;
        }

        case 'RENAME_PLAYER': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }

            const { username } = data;
            try {
                const updated = playerStore.renamePlayer(session.playerId, username);
                const playerData = playerStore.getPublicPlayerData(session.playerId);

                session.username = playerData.username;
                // Sincroniza a sessão da sala (chat e JOIN_ROOM usam esse objeto)
                const roomSession = clientSessions.get(ws);
                if (roomSession) roomSession.username = playerData.username;
                sendPlayerData(ws, playerData, session.sessionToken);
                console.log(`[RENAME] ${session.playerId} renomeado para '${playerData.username}'`);
            } catch (err) {
                sendError(ws, 'RENAME_FAILED', err.message);
            }
            break;
        }

        case 'JOIN_ROOM': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Autentique-se antes de entrar na sala');
                return;
            }

            const { roomId = 'town' } = data;
            const roomCfg = typeof roomId === 'string' ? getRoomConfig(roomId) : null;
            if (!roomCfg) {
                sendError(ws, 'INVALID_ROOM', 'Sala inválida');
                return;
            }
            // Lotação máxima por sala
            const room = getRoom(roomId);
            if (room.size >= roomCfg.maxPlayers) {
                sendError(ws, 'ROOM_FULL', 'Sala lotada, tente outra');
                return;
            }
            // Banimento checado a cada entrada em sala
            const ban = activeBanFor(session.playerId);
            if (ban) {
                const b = banErrorData(ban);
                sendError(ws, b.code, b.message);
                return;
            }
            const b = roomCfg.bounds;
            const jx = Math.max(b.minX, Math.min(b.maxX, Number(data.x) || 400));
            const jy = Math.max(b.minY, Math.min(b.maxY, Number(data.y) || 300));

            // Remove de sala anterior caso estivesse em alguma
            handleDisconnect(ws, false);

            const player = {
                playerId: session.playerId,
                username: session.username,
                roomId,
                x: jx,
                y: jy,
                color: session.colorItemId || 1,
                colorItemId: session.colorItemId || 1,
                paperdoll: sanitizePaperdoll(session.equipped),
                action: null,
                socket: ws
            };

            room.set(player.playerId, player);
            clientSessions.set(ws, player);

            console.log(`[JOIN] Jogador '${player.username}' (${player.playerId}) entrou na sala '${roomId}' em (${jx}, ${jy})`);
            log.info('room.join', { playerId: player.playerId, username: player.username, room: roomId, world: worlds.WORLD_ID });
            game.noteMission(player.playerId, 'join_room');

            // 1. Envia lista de todos os jogadores já presentes para o novo jogador
            const playerList = [];
            for (const [, p] of room.entries()) {
                playerList.push(publicPlayer(p));
            }

            ws.send(JSON.stringify({
                op: 'ROOM_STATE',
                data: {
                    roomId,
                    players: playerList
                }
            }));

            // 2. Transmite para todos os outros que este novo jogador entrou
            broadcastToRoom(roomId, {
                op: 'PLAYER_JOINED',
                data: publicPlayer(player)
            }, ws);
            break;
        }

        case 'MOVE_PLAYER': {
            const session = clientSessions.get(ws);
            if (!session) return;

            const { targetX, targetY } = data;
            // Valida contra os limites da sala atual (rooms.js)
            const cfg = getRoomConfig(session.roomId);
            const b = cfg ? cfg.bounds : { minX: 0, minY: 0, maxX: 760, maxY: 480 };
            const cx = Math.max(b.minX, Math.min(b.maxX, Number(targetX) || 0));
            const cy = Math.max(b.minY, Math.min(b.maxY, Number(targetY) || 0));
            session.x = cx;
            session.y = cy;
            session.action = null; // andar cancela emote/acao (dance, sit...)

            // Retransmite coordenadas para todos os outros na mesma sala
            broadcastToRoom(session.roomId, {
                op: 'MOVE_PLAYER',
                data: {
                    playerId: session.playerId,
                    targetX: cx,
                    targetY: cy
                }
            }, ws);
            break;
        }

        case 'PLAYER_ACTION': {
            const session = clientSessions.get(ws);
            if (!session) return;

            const action = data.action ?? null;
            const VALID = new Set(['dance', 'wave', 'throw', 'sit', 'stand', 'idle']);
            if (action !== null && !VALID.has(action)) return;
            session.action = action;

            broadcastToRoom(session.roomId, {
                op: 'PLAYER_ACTION',
                data: { playerId: session.playerId, action }
            }, ws);
            break;
        }

        case 'SEND_CHAT': {
            const session = clientSessions.get(ws);
            if (!session) return;

            const playerSession = clientPlayerData.get(ws);
            const { message } = data;
            if (!message || !message.trim()) return;

            // Silenciamento (muted_until)
            if (playerSession) {
                const p = playerStore.getPlayerById(playerSession.playerId);
                if (p && mod.isMuted(p)) {
                    const mins = Math.ceil((p.muted_until - Date.now()) / 60000);
                    sendError(ws, 'MUTED', `Você está silenciado por mais ${mins} min`);
                    return;
                }
            }

            // Limite de mensagens: máx. 4 por 5s por jogador
            const now = Date.now();
            const cq = (session.chatLog ||= []).filter((t) => now - t < 5000);
            session.chatLog = cq;
            if (cq.length >= 4) {
                sendError(ws, 'CHAT_RATE_LIMITED', 'Calma! Muitas mensagens seguidas.');
                return;
            }
            cq.push(now);

            let sanitized = message.trim().substring(0, 120);

            // Filtro de palavras (chat_filter_rule)
            const filtered = mod.filterChatMessage(sanitized);
            if (filtered?.blocked) {
                sendError(ws, 'CHAT_BLOCKED', 'Mensagem bloqueada pelo filtro');
                return;
            }
            if (filtered?.masked) sanitized = filtered.masked;

            console.log(`[CHAT] [${session.roomId}] ${session.username}: "${sanitized}"`);
            if (playerSession?.playerId) game.noteMission(playerSession.playerId, 'send_chat');

            // Transmite a mensagem para todos na sala (incluindo o remetente)
            broadcastToRoom(session.roomId, {
                op: 'SEND_CHAT',
                data: {
                    playerId: session.playerId,
                    username: session.username,
                    message: sanitized
                }
            });
            break;
        }

        case 'REPORT': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }
            const { targetPlayerId = null, targetMessage = null, reason = null } = data || {};
            if (targetPlayerId && !playerStore.getPlayerById(targetPlayerId)) {
                sendError(ws, 'INVALID_DATA', 'Jogador denunciado não encontrado');
                return;
            }
            mod.createReport({
                reporterId: session.playerId,
                targetPlayerId,
                targetMessage: typeof targetMessage === 'string' ? targetMessage.substring(0, 300) : null,
                reason: typeof reason === 'string' ? reason.substring(0, 200) : null
            });
            mod.audit(session.playerId, 'report.create', targetPlayerId, { reason });
            ws.send(JSON.stringify({ op: 'REPORT_OK', data: {} }));
            console.log(`[REPORT] ${session.username} denunciou ${targetPlayerId || '(mensagem)'}`);
            break;
        }

        // ---------- Ações de moderação (role >= moderator) ----------
        case 'MOD_ACTION': {
            const session = clientPlayerData.get(ws);
            if (!session || !session.playerId) {
                sendError(ws, 'NOT_AUTHENTICATED', 'Jogador não autenticado');
                return;
            }
            const me = playerStore.getPlayerById(session.playerId);
            if (!isModerator(me)) {
                sendError(ws, 'FORBIDDEN', 'Apenas moderadores');
                return;
            }
            const { action, targetPlayerId, reason = null, minutes = null } = data || {};
            const target = targetPlayerId ? playerStore.getPlayerById(targetPlayerId) : null;
            if (!target) { sendError(ws, 'INVALID_DATA', 'Jogador alvo não encontrado'); return; }
            if (target.player_id === me.player_id) { sendError(ws, 'INVALID_DATA', 'Não pode agir em si mesmo'); return; }
            // Só admin muda papéis (promover/rebaixar)
            const adminOnly = new Set(['mod.set_role']);
            if (adminOnly.has(action) && !mod.hasRole(me, mod.ROLES.ADMIN)) {
                sendError(ws, 'FORBIDDEN', 'Apenas administradores');
                return;
            }

            const targetWs = findSocketByPlayerId(target.player_id);
            switch (action) {
                case 'mod.kick': {
                    if (targetWs) {
                        sendError(targetWs, 'KICKED', `Expulso por ${me.username}${reason ? `: ${reason}` : ''}`);
                        handleDisconnect(targetWs, false);
                        targetWs.close();
                    }
                    mod.audit(me.player_id, 'mod.kick', target.player_id, { reason });
                    break;
                }
                case 'mod.mute': {
                    const mins = Math.max(1, Math.min(1440, Number(minutes) || 10));
                    mod.setMutedUntil(target.player_id, Date.now() + mins * 60000);
                    mod.addWarning(target.player_id, { moderatorId: me.player_id, reason: reason || `Silenciado por ${mins} min` });
                    mod.audit(me.player_id, 'mod.mute', target.player_id, { minutes: mins, reason });
                    break;
                }
                case 'mod.warn': {
                    mod.addWarning(target.player_id, { moderatorId: me.player_id, reason });
                    mod.audit(me.player_id, 'mod.warn', target.player_id, { reason });
                    break;
                }
                case 'mod.ban': {
                    const durationMs = minutes ? Math.min(Number(minutes), 60 * 24 * 365) * 60000 : null;
                    mod.banPlayer(target.player_id, { reason, moderatorId: me.player_id, durationMs });
                    if (targetWs) {
                        const b = banErrorData(mod.activeBan(target.player_id));
                        sendError(targetWs, b.code, b.message);
                        handleDisconnect(targetWs, false);
                        targetWs.close();
                    }
                    // revoga sessões do banido
                    accounts.revokeAllSessions(target.player_id);
                    mod.audit(me.player_id, 'mod.ban', target.player_id, { reason, minutes });
                    break;
                }
                case 'mod.unban': {
                    mod.unbanPlayerActive(target.player_id, me.player_id);
                    mod.audit(me.player_id, 'mod.unban', target.player_id, {});
                    break;
                }
                case 'mod.set_role': {
                    const newRole = String(data.newRole || '');
                    if (!Object.values(mod.ROLES).includes(newRole)) {
                        sendError(ws, 'INVALID_DATA', 'Role inválida');
                        return;
                    }
                    // Só admin rebaixa/promove; ninguém se promove
                    playerStore.setRole(target.player_id, newRole);
                    mod.audit(me.player_id, 'mod.set_role', target.player_id, { role: newRole });
                    break;
                }
                default:
                    sendError(ws, 'INVALID_DATA', 'Ação desconhecida');
                    return;
            }
            ws.send(JSON.stringify({
                op: 'MOD_OK',
                data: { action, targetPlayerId: target.player_id, username: target.username }
            }));
            console.log(`[MOD] ${me.username} executou ${action} em ${target.username}`);
            log.info('mod.action', { actor: me.username, actorId: me.player_id, action, target: target.username, targetId: target.player_id, reason });
            break;
        }

        case 'EQUIP_ITEM': {
            const session = clientSessions.get(ws);
            const playerSession = clientPlayerData.get(ws);
            if (!session || !playerSession) return;

            const slot = data.slot;
            if (!EQUIP_SLOTS.includes(slot)) return;

            const itemId = data.itemId || null;
            const n = itemId === null ? null : Number(itemId);
            if (n !== null && (!Number.isInteger(n) || n <= 0 || n > MAX_ITEM_ID)) return;

            // Valida posse no banco de dados
            if (n !== null) {
                try {
                    playerStore.equipItem(playerSession.playerId, slot, n);
                } catch (err) {
                    sendError(ws, 'EQUIP_FAILED', err.message);
                    return;
                }
            } else {
                playerStore.equipItem(playerSession.playerId, slot, null);
            }

            // Atualiza sessão local e sala
            session.paperdoll[slot] = n;
            const equipped = playerStore.getEquipped(playerSession.playerId);
            session.paperdoll = sanitizePaperdoll(equipped);
            // Mantém clientPlayerData sincronizado para o próximo JOIN_ROOM
            playerSession.equipped = equipped;

            console.log(`[EQUIP] ${session.username} ${slot}=${n ?? 'vazio'}`);

            broadcastToRoom(session.roomId, {
                op: 'EQUIP_ITEM',
                data: {
                    playerId: session.playerId,
                    slot,
                    itemId: n,
                    paperdoll: session.paperdoll
                }
            }, ws);
            break;
        }

        case 'SET_COLOR': {
            const session = clientSessions.get(ws);
            const playerSession = clientPlayerData.get(ws);
            if (!session || !playerSession) return;

            const colorItemId = Math.round(Number(data.colorItemId || data.color));
            if (!Number.isInteger(colorItemId) || colorItemId <= 0) return;

            // Valida posse quando o catalogo esta disponivel (cores pagas)
            if (catalog.isLoaded()) {
                const item = catalog.getAvailableItem(colorItemId);
                if (!item || item.type !== 1) {
                    sendError(ws, 'INVALID_COLOR', 'Cor inválida');
                    return;
                }
                if ((item.cost || 0) > 0 && !playerStore.hasItem(playerSession.playerId, colorItemId)) {
                    sendError(ws, 'ITEM_NOT_OWNED', 'Você não possui esta cor');
                    return;
                }
            }

            // Persiste no banco
            playerStore.updatePlayerColor(playerSession.playerId, colorItemId);
            session.colorItemId = colorItemId;
            session.color = colorItemId; // compatibilidade temporária
            playerSession.colorItemId = colorItemId; // sincroniza p/ JOIN_ROOM

            console.log(`[COLOR] ${session.username} -> item ${colorItemId}`);

            broadcastToRoom(session.roomId, {
                op: 'SET_COLOR',
                data: {
                    playerId: session.playerId,
                    colorItemId,
                    color: colorItemId // compatibilidade
                }
            }, ws);
            break;
        }
    }
}

function handleDisconnect(ws, log = true) {
    const session = clientSessions.get(ws);
    if (!session) return;

    const { roomId, playerId, username } = session;
    const room = rooms.get(roomId);
    if (room) {
        room.delete(playerId);
        if (room.size === 0) {
            rooms.delete(roomId);
        } else {
            // Notifica que o jogador saiu
            broadcastToRoom(roomId, {
                op: 'PLAYER_LEFT',
                data: { playerId }
            });
        }
    }

    clientSessions.delete(ws);
    // Mantém clientPlayerData para reconexão rápida na mesma sessão
    if (log) {
        console.log(`[-] Jogador '${username || playerId}' desconectou-se da sala '${roomId}'`);
    }
}
