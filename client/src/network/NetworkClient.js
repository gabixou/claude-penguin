/**
 * NetworkClient.js - Gerenciador WebSocket para o Club Penguin Phaser
 * Contrato de rede conforme especificação AGENTS.md / QWEN.md
 */

export default class NetworkClient {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.isConnected = false;
        this.playerId = 'Penguin_' + Math.floor(Math.random() * 8999 + 1000);
        this.reconnectTimer = null;
        
        // Endereço do WebSocket Server local (porta 8080)
        const host = window.location.hostname || 'localhost';
        this.url = `ws://${host}:8080`;

        this.connect();
    }

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        console.log(`[NetworkClient] Conectando a ${this.url}...`);
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log('[NetworkClient] Conectado ao servidor WebSocket com sucesso!');
            this.isConnected = true;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            this.scene.events.emit('net-connected', { playerId: this.playerId });
        };

        this.socket.onmessage = (event) => {
            try {
                const packet = JSON.parse(event.data);
                this.handlePacket(packet);
            } catch (err) {
                console.error('[NetworkClient] Erro ao decodificar pacote JSON:', err, event.data);
            }
        };

        this.socket.onclose = () => {
            console.warn('[NetworkClient] Conexão encerrada. Tentando reconectar em 3s...');
            this.isConnected = false;
            this.scene.events.emit('net-disconnected');
            this.scheduleReconnect();
        };

        this.socket.onerror = (error) => {
            console.error('[NetworkClient] Erro no socket:', error);
        };
    }

    scheduleReconnect() {
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.connect();
            }, 3000);
        }
    }

    send(op, data = {}) {
        if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn(`[NetworkClient] Não foi possível enviar ${op}: socket desconectado.`);
            return;
        }
        const packet = JSON.stringify({ op, data });
        this.socket.send(packet);
    }

    // Ações do Jogador conforme protocolo AGENTS.md
    joinRoom(roomId = 'town', x = 400, y = 300) {
        this.send('JOIN_ROOM', {
            playerId: this.playerId,
            roomId,
            x,
            y
        });
    }

    sendMove(targetX, targetY) {
        this.send('MOVE_PLAYER', {
            playerId: this.playerId,
            targetX: Math.round(targetX),
            targetY: Math.round(targetY)
        });
    }

    sendChat(message) {
        if (!message || !message.trim()) return;
        this.send('SEND_CHAT', {
            playerId: this.playerId,
            message: message.trim()
        });
    }

    // Processamento de pacotes recebidos e emissão de eventos no Phaser
    handlePacket(packet) {
        const { op, data } = packet;
        if (!op) return;

        switch (op) {
            case 'JOIN_ROOM':
            case 'ROOM_STATE':
                this.scene.events.emit('room-state', data);
                break;
            case 'MOVE_PLAYER':
                this.scene.events.emit('player-move', data);
                break;
            case 'SEND_CHAT':
                this.scene.events.emit('player-chat', data);
                break;
            case 'PLAYER_JOINED':
                this.scene.events.emit('player-joined', data);
                break;
            case 'PLAYER_LEFT':
                this.scene.events.emit('player-left', data);
                break;
            default:
                this.scene.events.emit('packet-' + op, data);
                break;
        }
    }
}
