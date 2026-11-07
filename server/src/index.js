/**
 * index.js - Servidor WebSocket Multiplayer para Club Penguin Browser
 * Porta: 8080
 * Suporta múltiplas salas, movimentação com sincronização e chat em tempo real.
 */

import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Estado das salas em memória: { roomId: Map<playerId, playerObject> }
const rooms = new Map();
// Mapeamento de socket para dados do jogador
const clientSessions = new Map();

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
    const ip = req.socket.remoteAddress;
    console.log(`[+] Nova conexão estabelecida de ${ip}`);

    ws.on('message', (raw) => {
        try {
            const packet = JSON.parse(raw.toString());
            handlePacket(ws, packet);
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

function handlePacket(ws, packet) {
    const { op, data } = packet;
    if (!op || !data) return;

    switch (op) {
        case 'JOIN_ROOM': {
            const { playerId, roomId = 'town', x = 400, y = 300, color } = data;
            
            // Remove de sala anterior caso estivesse em alguma
            handleDisconnect(ws, false);

            const room = getRoom(roomId);
            const player = {
                playerId,
                roomId,
                x,
                y,
                color: color || 0x0088ff,
                socket: ws
            };

            room.set(playerId, player);
            clientSessions.set(ws, player);

            console.log(`[JOIN] Jogador '${playerId}' entrou na sala '${roomId}' em (${x}, ${y})`);

            // 1. Envia lista de todos os jogadores já presentes para o novo jogador
            const playerList = [];
            for (const [id, p] of room.entries()) {
                playerList.push({
                    playerId: p.playerId,
                    x: p.x,
                    y: p.y,
                    color: p.color
                });
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
                data: {
                    playerId,
                    x,
                    y,
                    color: player.color
                }
            }, ws);
            break;
        }

        case 'MOVE_PLAYER': {
            const session = clientSessions.get(ws);
            if (!session) return;

            const { targetX, targetY } = data;
            session.x = targetX;
            session.y = targetY;

            // Retransmite coordenadas para todos os outros na mesma sala
            broadcastToRoom(session.roomId, {
                op: 'MOVE_PLAYER',
                data: {
                    playerId: session.playerId,
                    targetX,
                    targetY
                }
            }, ws);
            break;
        }

        case 'SEND_CHAT': {
            const session = clientSessions.get(ws);
            if (!session) return;

            const { message } = data;
            if (!message || !message.trim()) return;

            const sanitized = message.trim().substring(0, 120);
            console.log(`[CHAT] [${session.roomId}] ${session.playerId}: "${sanitized}"`);

            // Transmite a mensagem para todos na sala (incluindo o remetente)
            broadcastToRoom(session.roomId, {
                op: 'SEND_CHAT',
                data: {
                    playerId: session.playerId,
                    message: sanitized
                }
            });
            break;
        }
    }
}

function handleDisconnect(ws, log = true) {
    const session = clientSessions.get(ws);
    if (!session) return;

    const { roomId, playerId } = session;
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
    if (log) {
        console.log(`[-] Jogador '${playerId}' desconectou-se da sala '${roomId}'`);
    }
}
