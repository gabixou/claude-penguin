/**
 * RoomScene.js - Club Penguin / GoPenguin Fiel ao Original
 * Interface idêntica à captura de tela de gopenguin.lol:
 * - Cenário Town autêntico
 * - Botão Envelope de Correio (topo esquerdo)
 * - Botão MAP clássico (inferior esquerdo)
 * - Barra inferior Dock clássica com reflexo, gradiente azul e botões originais
 * - Anel de seleção azul sob os pés do pinguim do jogador
 * - Sincronização WebSocket de salas, movimento e chat
 */

import Phaser from 'phaser';
import NetworkClient from '../network/NetworkClient.js';
import Penguin from '../entities/Penguin.js';

export default class RoomScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RoomScene' });
        this.network = null;
        this.localPlayer = null;
        this.remotePlayers = new Map();
        this.currentRoom = 'town';
        this.mapOpen = false;
    }

    create() {
        const { width, height } = this.scale;

        // 1. Cenário de Fundo Autêntico (Town)
        this.bg = this.add.image(width / 2, height / 2, `room_${this.currentRoom}`);
        this.bg.setDisplaySize(width, height);
        this.bg.setDepth(0);

        // 2. Conexão WebSocket
        this.network = new NetworkClient(this);

        // 3. Pinguim do Jogador Local com anel de seleção autêntico
        const startX = width / 2;
        const startY = height * 0.65;
        this.localPlayer = new Penguin(this, startX, startY, this.network.playerId, 'Você (' + this.network.playerId + ')', 0x0088ff);
        
        // Adiciona anel de seleção azul sob o pinguim local (igual ao Icy942 da imagem)
        this.selectionRing = this.add.ellipse(0, 0, 48, 20);
        this.selectionRing.setStrokeStyle(2.5, 0x00aaff, 0.9);
        this.localPlayer.add(this.selectionRing);
        this.localPlayer.sendToBack(this.selectionRing);

        // 4. Click-to-Move no Cenário
        this.input.on('pointerdown', (pointer) => {
            if (this.mapOpen || pointer.y > height - 60) return;

            const targetX = Math.round(pointer.x);
            const targetY = Math.round(pointer.y);

            this.localPlayer.moveTo(targetX, targetY);
            this.network.sendMove(targetX, targetY);
        });

        // 5. Configurar Eventos da Rede
        this.setupNetworkEvents();

        // 6. Criar HUD Autêntica (Idêntica à imagem do GoPenguin)
        this.createAuthenticHUD();

        // 7. Modal do Mapa da Ilha
        this.createMapModal();

        // 8. Entrada na sala
        this.events.on('net-connected', () => {
            this.network.joinRoom(this.currentRoom, startX, startY);
        });
    }

    setupNetworkEvents() {
        this.events.on('room-state', (data) => {
            if (!data || !data.players) return;
            this.clearRemotePlayers();
            data.players.forEach(p => {
                if (p.playerId !== this.network.playerId) {
                    this.upsertRemotePlayer(p.playerId, p.x, p.y, p.color);
                }
            });
        });

        this.events.on('player-move', (data) => {
            if (!data || data.playerId === this.network.playerId) return;
            let penguin = this.remotePlayers.get(data.playerId);
            if (!penguin) {
                penguin = this.upsertRemotePlayer(data.playerId, data.targetX, data.targetY);
            }
            penguin.moveTo(data.targetX, data.targetY);
        });

        this.events.on('player-chat', (data) => {
            if (!data) return;
            if (data.playerId === this.network.playerId) {
                this.localPlayer.showChat(data.message);
            } else {
                const penguin = this.remotePlayers.get(data.playerId);
                if (penguin) {
                    penguin.showChat(data.message);
                }
            }
        });

        this.events.on('player-joined', (data) => {
            if (!data || data.playerId === this.network.playerId) return;
            this.upsertRemotePlayer(data.playerId, data.x, data.y, data.color);
        });

        this.events.on('player-left', (data) => {
            if (!data) return;
            const penguin = this.remotePlayers.get(data.playerId);
            if (penguin) {
                penguin.destroy();
                this.remotePlayers.delete(data.playerId);
            }
        });
    }

    clearRemotePlayers() {
        for (const [id, penguin] of this.remotePlayers.entries()) {
            penguin.destroy();
        }
        this.remotePlayers.clear();
    }

    upsertRemotePlayer(playerId, x = 380, y = 300, color = null) {
        let penguin = this.remotePlayers.get(playerId);
        if (!penguin) {
            const colors = [0xe74c3c, 0x2ecc71, 0x9b59b6, 0xf39c12, 0xff55aa, 0x34495e, 0x16a085];
            const chosenColor = color || colors[Math.floor(Math.random() * colors.length)];
            penguin = new Penguin(this, x, y, playerId, playerId, chosenColor);
            this.remotePlayers.set(playerId, penguin);
        }
        return penguin;
    }

    createAuthenticHUD() {
        const { width, height } = this.scale;

        // ==========================================
        // 1. BOTÃO DE CORREIO / ENVELOPE (Topo Esquerdo)
        // ==========================================
        const mailBtn = this.add.container(40, 40).setDepth(15000);
        const mailBg = this.add.graphics();
        mailBg.fillStyle(0xcccccc, 1);
        mailBg.lineStyle(2.5, 0x222222, 1);
        mailBg.fillRoundedRect(-22, -16, 44, 32, 6);
        mailBg.strokeRoundedRect(-22, -16, 44, 32, 6);
        // Dobra do envelope
        mailBg.strokeTriangle(-20, -14, 20, -14, 0, 4);

        mailBtn.add(mailBg);
        mailBtn.setSize(44, 32);
        mailBtn.setInteractive(new Phaser.Geom.Rectangle(-22, -16, 44, 32), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        mailBtn.on('pointerdown', () => {
            this.localPlayer.showChat("📬 Nenhuma mensagem nova no correio.");
        });

        // ==========================================
        // 2. BOTÃO CLÁSSICO MAP (Inferior Esquerdo)
        // ==========================================
        const mapBtn = this.add.container(44, height - 52).setDepth(15000);
        const mapBg = this.add.graphics();
        mapBg.fillStyle(0x0077cc, 1);
        mapBg.lineStyle(3, 0x111111, 1);
        mapBg.fillRoundedRect(-24, -26, 48, 52, 6);
        mapBg.strokeRoundedRect(-24, -26, 48, 52, 6);
        // Dobras do mapa
        mapBg.fillStyle(0x0099ff, 1);
        mapBg.fillRect(-22, -24, 20, 48);

        const mapText = this.add.text(0, 0, "MAP", {
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ffff00',
            stroke: '#002244',
            strokeThickness: 3
        }).setOrigin(0.5);

        mapBtn.add([mapBg, mapText]);
        mapBtn.setSize(48, 52);
        mapBtn.setInteractive(new Phaser.Geom.Rectangle(-24, -26, 48, 52), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        mapBtn.on('pointerdown', () => this.toggleMap());

        // ==========================================
        // 3. BARRA INFERIOR DOCK (Idêntica à imagem)
        // ==========================================
        const dockY = height - 28;
        const dockW = width - 130;
        const dockH = 46;
        const dockX = 105;

        const dockBg = this.add.graphics().setDepth(14999);
        // Borda externa azul-claro brilhante
        dockBg.fillStyle(0x0288d1, 1);
        dockBg.fillRoundedRect(dockX - 3, dockY - 23 - 3, dockW + 6, dockH + 6, 22);

        // Fundo azul marinho clássico
        dockBg.fillStyle(0x01579b, 1);
        dockBg.fillRoundedRect(dockX, dockY - 23, dockW, dockH, 20);

        // Brilho/reflexo superior da barra
        dockBg.fillStyle(0x29b6f6, 0.45);
        dockBg.fillRoundedRect(dockX + 4, dockY - 21, dockW - 8, 14, 8);

        // Botões do Lado Esquerdo do Dock:
        // [Chat Rápido, Emoticons, Ações, Bola de Neve]
        this.createCircularDockButton(dockX + 24, dockY, '💬', 0x0277bd, () => {
            this.localPlayer.showChat("Olá a todos!");
            this.network.sendChat("Olá a todos!");
        });

        this.createCircularDockButton(dockX + 54, dockY, '😊', 0xfbc02d, () => {
            this.localPlayer.showChat("😄");
            this.network.sendChat("😄");
        });

        this.createCircularDockButton(dockX + 84, dockY, '🐧', 0x0288d1, () => {
            this.localPlayer.showChat("*acenando*");
            this.network.sendChat("*acenando*");
        });

        this.createCircularDockButton(dockX + 114, dockY, '❄️', 0xffffff, () => {
            this.localPlayer.showChat("*jogou uma bola de neve!*");
            this.network.sendChat("*jogou uma bola de neve!*");
        });

        // Botões do Lado Direito do Dock:
        // [Histórico, Estrela, Amigos, Casa/Igloo, Ajuda]
        const rightStart = dockX + dockW - 135;
        this.createCircularDockButton(rightStart, dockY, '📜', 0x0288d1, () => {
            this.localPlayer.showChat("Abrindo histórico...");
        });

        this.createCircularDockButton(rightStart + 28, dockY, '⭐', 0xfbc02d, () => {
            this.localPlayer.showChat("Meus selos e emblemas");
        });

        this.createCircularDockButton(rightStart + 56, dockY, '👥', 0xfbc02d, () => {
            this.localPlayer.showChat("Lista de amigos");
        });

        this.createCircularDockButton(rightStart + 84, dockY, '🏠', 0x0288d1, () => {
            this.changeRoom('lodge');
        });

        this.createCircularDockButton(rightStart + 112, dockY, '❓', 0x03a9f4, () => {
            this.localPlayer.showChat("Ajuda: Clique para andar. Use o MAPA para viajar!");
        });

        // ==========================================
        // 4. CAMPO DE TEXTO CÁPSULA (Centro da Dock)
        // ==========================================
        const chatInput = document.createElement('input');
        chatInput.type = 'text';
        chatInput.placeholder = 'Digite aqui para conversar... (Enter para enviar)';
        chatInput.style.position = 'fixed';
        chatInput.style.bottom = '14px';
        chatInput.style.left = '49%';
        chatInput.style.transform = 'translateX(-50%)';
        chatInput.style.width = '245px';
        chatInput.style.padding = '5px 12px';
        chatInput.style.borderRadius = '14px';
        chatInput.style.border = '2px solid #0288d1';
        chatInput.style.backgroundColor = '#001c3d';
        chatInput.style.color = '#ffffff';
        chatInput.style.fontSize = '12px';
        chatInput.style.fontWeight = 'bold';
        chatInput.style.outline = 'none';
        chatInput.style.zIndex = '9999';

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const text = chatInput.value.trim();
                if (text) {
                    this.network.sendChat(text);
                    chatInput.value = '';
                }
            }
        });

        document.body.appendChild(chatInput);
    }

    createCircularDockButton(x, y, iconChar, bgColor, callback) {
        const btn = this.add.container(x, y).setDepth(15001);
        const g = this.add.graphics();
        // Círculo com relevo Club Penguin
        g.fillStyle(bgColor, 1);
        g.fillCircle(0, 0, 11);
        g.lineStyle(1.5, 0xffffff, 0.85);
        g.strokeCircle(0, 0, 11);

        const icon = this.add.text(0, 0, iconChar, {
            fontSize: '11px',
            align: 'center'
        }).setOrigin(0.5);

        btn.add([g, icon]);
        btn.setSize(22, 22);
        btn.setInteractive(new Phaser.Geom.Circle(0, 0, 11), Phaser.Geom.Circle.Contains, { useHandCursor: true });

        btn.on('pointerdown', callback);
        return btn;
    }

    createMapModal() {
        const { width, height } = this.scale;
        this.mapModal = this.add.container(0, 0);
        this.mapModal.setDepth(20000);
        this.mapModal.setVisible(false);

        const darkOverlay = this.add.graphics();
        darkOverlay.fillStyle(0x000000, 0.7);
        darkOverlay.fillRect(0, 0, width, height);
        darkOverlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        const panelW = 580;
        const panelH = 360;
        const px = width / 2 - panelW / 2;
        const py = height / 2 - panelH / 2;

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x003366, 0.98);
        panelBg.fillRoundedRect(px, py, panelW, panelH, 12);
        panelBg.lineStyle(3, 0xffcc00, 1);
        panelBg.strokeRoundedRect(px, py, panelW, panelH, 12);

        const title = this.add.text(width / 2, py + 22, 'MAPA DA ILHA - VIAJAR PARA OUTRA SALA', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#ffcc00'
        }).setOrigin(0.5);

        const closeBtn = this.add.text(px + panelW - 24, py + 18, '✖', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '18px',
            color: '#ff4444'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.toggleMap());

        this.mapModal.add([darkOverlay, panelBg, title, closeBtn]);

        const rooms = [
            { key: 'town', name: 'Centro (Town)' },
            { key: 'coffee', name: 'Café (Coffee Shop)' },
            { key: 'dance', name: 'Boate (Night Club)' },
            { key: 'pizza', name: 'Pizzaria (Pizza Parlor)' },
            { key: 'plaza', name: 'Plaza' },
            { key: 'forts', name: 'Fortes de Neve (Snow Forts)' },
            { key: 'dojo', name: 'Dojo' },
            { key: 'beach', name: 'Praia (Beach)' },
            { key: 'dock', name: 'Ancoradouro (Dock)' },
            { key: 'lodge', name: 'Cabana (Ski Lodge)' },
            { key: 'mine', name: 'Mina (Mine)' },
            { key: 'rink', name: 'Estádio de Gelo (Ice Rink)' }
        ];

        const cols = 3;
        const bw = 165;
        const bh = 46;
        const startX = px + 35;
        const startY = py + 55;

        rooms.forEach((r, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const bx = startX + col * (bw + 15);
            const by = startY + row * (bh + 14);

            const card = this.add.container(bx, by);
            const cardBg = this.add.graphics();
            cardBg.fillStyle(0x005599, 1);
            cardBg.fillRoundedRect(0, 0, bw, bh, 6);
            cardBg.lineStyle(2, 0x00aaff, 1);
            cardBg.strokeRoundedRect(0, 0, bw, bh, 6);

            const text = this.add.text(bw / 2, bh / 2, r.name, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#ffffff'
            }).setOrigin(0.5);

            card.add([cardBg, text]);
            card.setSize(bw, bh);
            card.setInteractive(new Phaser.Geom.Rectangle(0, 0, bw, bh), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

            card.on('pointerdown', () => this.changeRoom(r.key));
            this.mapModal.add(card);
        });
    }

    toggleMap() {
        this.mapOpen = !this.mapOpen;
        this.mapModal.setVisible(this.mapOpen);
    }

    changeRoom(newRoomKey) {
        if (this.currentRoom === newRoomKey) return;
        this.currentRoom = newRoomKey;

        const textureKey = `room_${newRoomKey}`;
        if (this.textures.exists(textureKey)) {
            this.bg.setTexture(textureKey);
        }

        const { width, height } = this.scale;
        const startX = width / 2;
        const startY = height * 0.65;
        this.localPlayer.setPosition(startX, startY);
        this.localPlayer.updateDepth();

        this.clearRemotePlayers();
        this.network.joinRoom(newRoomKey, startX, startY);

        if (this.mapOpen) {
            this.toggleMap();
        }
    }
}
