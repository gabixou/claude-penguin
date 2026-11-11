/**
 * index.js - Servidor WebSocket Multiplayer para Club Penguin Browser
 * Porta: 8080
 * Suporta múltiplas salas, movimentação com sincronização, chat em tempo real,
 * autenticação guest por IP/cookie e persistência SQLite.
 */

import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import auth from './auth.js';
import playerStore from './playerStore.js';
import catalog from './catalog.js';
import { clientIp, isLoopbackIp } from './net.js';

const PORT = process.env.PORT || 8080;
// maxPayload: pacotes do protocolo sao JSON pequenos (<2KB); 16KB e folga
// generosa e impede flood de memoria via mensagens gigantes.
const wss = new WebSocketServer({ port: PORT, maxPayload: 16 * 1024 });

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

console.log(`===================================================`);
console.log(`🐧 Servidor Club Penguin WebSocket rodando na porta ${PORT}`);
console.log(`📡 URL de conexão: ws://localhost:${PORT}`);
console.log(`===================================================`);

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

// Arenovisk: pinguim de teste do dono do PC (IPs loopback). Criado sob
// demanda; a flag all_items faz hasItem/getInventory cobrir o catalogo
// inteiro e coins generosas para testar compras/equipamentos.
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

// IPs que tem direito ao Arenovisk: por padrao so loopback (o PC do
// tester). Para liberar outro IP (ex.: IP publico do tester em producao),
// defina ARENOVISK_IPS="ip1,ip2" no ambiente do servidor.
const ARENOVISK_IPS = new Set(
    (process.env.ARENOVISK_IPS || '::1,127.0.0.1,::ffff:127.0.0.1')
        .split(',').map((s) => s.trim()).filter(Boolean)
);
function isArenoviskIp(ip) {
    return ARENOVISK_IPS.has(ip || '');
}

// Login por nome (LOGIN_PLAYER) continua restrito a loopback por seguranca.

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
function sendPlayerSession(ws, player, sessionToken) {
    const playerData = playerStore.getPublicPlayerData(player.player_id);
    const coinsBefore = playerData.coins;
    const withBonus = auth.applyDailyBonusIfNeeded(player.player_id);
    const finalData = playerStore.getPublicPlayerData(withBonus.player_id);
    const bonus = finalData.coins - coinsBefore;
    if (bonus > 0) finalData.dailyBonus = bonus;

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

function handlePacket(ws, req, packet) {
    const { op, data } = packet;
    if (!op || !data) return;

    switch (op) {
        case 'AUTH_GUEST': {
            const ip = clientIp(req);

            // IP autorizado (PC do tester): Arenovisk tem PRIORIDADE sobre
            // token/IP-fallback — senao qualquer guest criado daquele IP
            // bloquearia o Arenovisk para sempre. forceGuest/automacao
            // ainda recebem pinguim normal.
            if (isArenoviskIp(ip) && !data.forceGuest && !isAutomationClient(req)) {
                const player = ensureArenovisk(ip);
                const sessionToken = crypto.randomBytes(32).toString('hex');
                playerStore.updatePlayerSession(player.player_id, sessionToken);
                sendPlayerSession(ws, player, sessionToken);
                console.log(`[AUTH] Arenovisk (${player.player_id}) atribuido a ${ip}`);
                break;
            }

            // Cliente envia sessionToken do localStorage (se houver)
            const clientToken = data.sessionToken || null;
            const result = auth.identifyPlayer(req, clientToken);

            if (result.player) {
                sendPlayerSession(ws, result.player, result.sessionToken);
                console.log(`[AUTH] Jogador '${result.player.username}' (${result.player.player_id}) autenticado via ${result.sessionToken ? 'token' : 'IP'}`);
            } else {
                // Guest flow: cria o pinguim na hora, sem tela de conta
                const guestName = generateGuestName();
                const created = auth.createNewPlayer(result.ip, guestName, 1);
                sendPlayerSession(ws, created.player, created.sessionToken);
                console.log(`[AUTH] Novo pinguim '${guestName}' (${created.player.player_id}) criado automaticamente`);
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
            const sessionToken = crypto.randomBytes(32).toString('hex');
            playerStore.updatePlayerSession(player.player_id, sessionToken);
            sendPlayerSession(ws, player, sessionToken);
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
                const result = auth.createNewPlayer(session.ip, username, colorItemId);
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

            // Preco autoritativo do catalogo — ignora `cost` do cliente
            const item = catalog.getItem(itemId);
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

            // Recompensa de minigame — 50 coins por level concluido, ou
            // `amount` explicito do cliente (ex.: Ice Fishing manda o score
            // da rodada). Cap de 500 para evitar abuso.
            const level = Math.floor(Number(data.level));
            if (!Number.isFinite(level) || level < 1 || level > 99) {
                sendError(ws, 'INVALID_DATA', 'level inválido');
                return;
            }
            const amount = Math.floor(Number(data.amount));
            const reward = Number.isFinite(amount) && amount >= 1
                ? Math.min(amount, 500)
                : 50;
            playerStore.addCoins(session.playerId, reward);
            const playerData = playerStore.getPublicPlayerData(session.playerId);
            session.coins = playerData.coins;
            sendPlayerData(ws, playerData, session.sessionToken);
            ws.send(JSON.stringify({
                op: 'MINIGAME_REWARD',
                data: { level, reward, coins: playerData.coins }
            }));
            console.log(`[REWARD] ${session.username} concluiu level ${level} de minigame (+${reward} coins)`);
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
            if (typeof roomId !== 'string' || !/^[a-z0-9_-]{1,24}$/i.test(roomId)) {
                sendError(ws, 'INVALID_ROOM', 'Sala inválida');
                return;
            }
            const jx = Math.max(0, Math.min(760, Number(data.x) || 400));
            const jy = Math.max(0, Math.min(480, Number(data.y) || 300));

            // Remove de sala anterior caso estivesse em alguma
            handleDisconnect(ws, false);

            const room = getRoom(roomId);
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
            // clamp nas coordenadas do mundo (760x480) — impede valores absurdos
            const cx = Math.max(0, Math.min(760, Number(targetX) || 0));
            const cy = Math.max(0, Math.min(480, Number(targetY) || 0));
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

            const { message } = data;
            if (!message || !message.trim()) return;

            const sanitized = message.trim().substring(0, 120);
            console.log(`[CHAT] [${session.roomId}] ${session.username}: "${sanitized}"`);

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
                const item = catalog.getItem(colorItemId);
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
