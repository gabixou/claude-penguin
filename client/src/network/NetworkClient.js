/**
 * NetworkClient.js - Gerenciador WebSocket para o Club Penguin Phaser
 * Contrato de rede conforme especificação AGENTS.md / QWEN.md
 * Agora com autenticação guest e persistência via servidor.
 */

import { DEFAULT_COLOR_ITEM_ID, colorItemToRgb } from '../items/colors.js';
import { mark } from '../perf.js';

export default class NetworkClient {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.isConnected = false;
        this.reconnectTimer = null;
        
        // Dados do jogador (preenchido após PLAYER_DATA)
        this.playerData = null;
        this.playerId = null;
        this.username = null;
        this.colorItemId = DEFAULT_COLOR_ITEM_ID;
        this.coins = 0;
        this.inventory = [];
        this.equipped = {};
        this.canRename = false;

        // Estado social (fase 1): buddies, pedidos, ignores, pets
        this.social = { buddies: [], requests: [], ignores: [], pets: [], petSpecies: [] };
        this.party = null; // festa ativa — vem no PLAYER_DATA
        
        this.url = NetworkClient.resolveUrl();
        // socket aberto (e ja autenticado) por preconnect() antes do Phaser
        // subir: adota em vez de abrir outro
        if (!this._adoptEarly()) this.connect();
    }

    // URL do WebSocket: VITE_WS_URL tem prioridade (producao); senao
    // deriva do hostname — https => wss na mesma origem (Caddy faz
    // proxy /ws), http local => ws://host:8080.
    static resolveUrl() {
        const envUrl = import.meta.env?.VITE_WS_URL;
        if (envUrl) return envUrl;
        if (window.location.protocol === 'https:') return `wss://${window.location.host}/ws`;
        return `ws://${window.location.hostname || 'localhost'}:8080`;
    }

    // Pacotes de autenticacao enviados ao abrir o socket.
    static authPackets() {
        const params = new URLSearchParams(location.search);
        // ?penguin=Nome (ou localStorage penguin_user) -> LOGIN_PLAYER
        // (somente funciona em localhost — o servidor bloqueia em producao)
        const want = params.get('penguin') || localStorage.getItem('penguin_user');
        if (want) {
            if (params.get('penguin')) localStorage.setItem('penguin_user', want);
            return [['LOGIN_PLAYER', { username: want }]];
        }
        // ?guest=1 ou automacao (navigator.webdriver = Playwright etc.) ->
        // entra direto como visitante, sem tela de login
        const forceGuest = params.get('guest') === '1' || !!navigator.webdriver;
        if (forceGuest) localStorage.removeItem('penguin_user');
        const sessionToken = localStorage.getItem('penguin_session');
        // Sem token e sem pedido de guest: servidor responde NEED_AUTH
        // e o cliente abre a tela de login/cadastro.
        return [
            ['AUTH_GUEST', {
                sessionToken: sessionToken || undefined,
                forceGuest: forceGuest || undefined,
            }],
        ];
    }

    // Otimista: abre o WebSocket e autentica ENQUANTO o Phaser, as fontes e
    // os packs ainda carregam (antes so conectava depois do boot inteiro).
    // Mensagens recebidas antes da cena existir ficam na fila e sao
    // entregues quando o NetworkClient adota o socket.
    static preconnect() {
        if (NetworkClient._early || typeof WebSocket === 'undefined') return;
        let socket;
        const url = NetworkClient.resolveUrl();
        try { socket = new WebSocket(url); } catch { return; }
        const early = { socket, url, queue: [], authSent: false };
        socket.onopen = () => {
            mark('ws-open');
            try {
                for (const [op, data] of NetworkClient.authPackets())
                    socket.send(JSON.stringify({ op, data }));
                early.authSent = true;
            } catch { /* adocao reenvia */ }
        };
        socket.onmessage = (ev) => {
            try { early.queue.push(JSON.parse(ev.data)); } catch { /* ignora */ }
        };
        NetworkClient._early = early;
    }

    _adoptEarly() {
        const early = NetworkClient._early;
        NetworkClient._early = null;
        if (!early) return false;
        const { socket } = early;
        if (early.url !== this.url || socket.readyState === WebSocket.CLOSING
            || socket.readyState === WebSocket.CLOSED) {
            try { socket.close(); } catch { /* noop */ }
            return false;
        }
        this.socket = socket;
        this._wire(socket, { authSent: early.authSent });
        if (socket.readyState === WebSocket.OPEN) {
            this.isConnected = true;
            console.log('[NetworkClient] Conectado (pré-conexão adotada).');
            if (!early.authSent) this.authenticate();
        }
        // entrega a fila depois que a cena registrou os listeners (o
        // construtor roda no meio do RoomScene.create, sincrono)
        const queued = early.queue;
        early.queue = null;
        if (queued.length) Promise.resolve().then(() => {
            for (const p of queued) this.handlePacket(p);
        });
        return true;
    }

    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        console.log(`[NetworkClient] Conectando a ${this.url}...`);
        this.socket = new WebSocket(this.url);
        this._wire(this.socket);
    }

    _wire(socket, { authSent = false } = {}) {
        socket.onopen = () => {
            mark('ws-open');
            console.log('[NetworkClient] Conectado ao servidor WebSocket com sucesso!');
            this.isConnected = true;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            // Envia autenticação guest automaticamente
            if (!authSent) this.authenticate();
        };

        socket.onmessage = (event) => {
            try {
                const packet = JSON.parse(event.data);
                this.handlePacket(packet);
            } catch (err) {
                console.error('[NetworkClient] Erro ao decodificar pacote JSON:', err, event.data);
            }
        };

        socket.onclose = () => {
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

    // ---------- Autenticação ----------

    authenticate() {
        for (const [op, data] of NetworkClient.authPackets()) this.send(op, data);
    }

    playAsGuest() {
        localStorage.removeItem('penguin_session');
        this.send('AUTH_GUEST', { guest: true });
    }

    loginPlayer(username) {
        this.send('LOGIN_PLAYER', { username });
    }

    createPlayer(username, colorItemId = DEFAULT_COLOR_ITEM_ID) {
        this.send('CREATE_PLAYER', { username, colorItemId });
    }

    loadPlayer() {
        this.send('LOAD_PLAYER', {});
    }

    renamePlayer(username) {
        this.send('RENAME_PLAYER', { username });
    }

    buyItem(itemId, cost) {
        this.send('BUY_ITEM', { itemId, cost });
    }

    // Compra com confirmacao — resolve {ok,data} no ITEM_BOUGHT ou {ok:false,error}.
    buyItemAsync(itemId) {
        return new Promise((resolve) => {
            const to = setTimeout(() => { cleanup(); resolve({ ok: false, error: 'timeout' }); }, 8000);
            const onBought = (d) => {
                if (Number(d?.itemId) === Number(itemId)) { cleanup(); resolve({ ok: true, data: d }); }
            };
            const onErr = (d) => { cleanup(); resolve({ ok: false, code: d?.code, error: d?.message || d?.code || 'failed' }); };
            const cleanup = () => {
                clearTimeout(to);
                this.scene.events.off('item-bought', onBought);
                this.scene.events.off('net-error', onErr);
            };
            this.scene.events.on('item-bought', onBought);
            this.scene.events.on('net-error', onErr);
            this.buyItem(itemId);
        });
    }

    // ---------- Ações do Jogador ----------

    joinRoom(roomId = 'town', x = 400, y = 300) {
        if (!this.playerId) {
            console.warn('[NetworkClient] Tentativa de entrar na sala antes de autenticar');
            return;
        }
        this.send('JOIN_ROOM', {
            roomId,
            x,
            y
        });
    }

    sendEquip(slot, itemId) {
        this.send('EQUIP_ITEM', {
            slot,
            itemId: itemId || null
        });
    }

    sendMove(targetX, targetY) {
        this.send('MOVE_PLAYER', {
            targetX: Math.round(targetX),
            targetY: Math.round(targetY)
        });
    }

    sendColor(colorItemId) {
        this.send('SET_COLOR', {
            colorItemId: Math.round(colorItemId)
        });
    }

    sendChat(message) {
        if (!message || !message.trim()) return;
        this.send('SEND_CHAT', {
            message: message.trim()
        });
    }

    // Emote/acao do pinguim (dance, wave, throw, sit, stand, idle) —
    // sincroniza a animacao nos outros clientes da sala.
    sendAction(action) {
        this.send('PLAYER_ACTION', { action: action || null });
    }

    // ---------- Social (fase 1) ----------

    getSocial() {
        this.send('GET_SOCIAL', {});
    }

    buddyAdd(username) { this.send('BUDDY_ADD', { username }); }
    buddyAccept(playerId) { this.send('BUDDY_ACCEPT', { playerId }); }
    buddyDecline(playerId) { this.send('BUDDY_DECLINE', { playerId }); }
    buddyCancel(playerId) { this.send('BUDDY_CANCEL', { playerId }); }
    buddyRemove(playerId) { this.send('BUDDY_REMOVE', { playerId }); }
    ignoreAdd(playerId) { this.send('IGNORE_ADD', { playerId }); }
    ignoreRemove(playerId) { this.send('IGNORE_REMOVE', { playerId }); }
    petAdopt(species, name) { this.send('PET_ADOPT', { species, name }); }
    petRename(petRowId, name) { this.send('PET_RENAME', { petRowId, name }); }
    petRelease(petRowId) { this.send('PET_RELEASE', { petRowId }); }
    petCare(petRowId, action) { this.send('PET_CARE', { petRowId, action }); }
    petEquip(petRowId) { this.send('PET_EQUIP', { petRowId }); }

    // helpers de estado social
    isBuddy(playerId) { return this.social.buddies.some((b) => b.playerId === playerId); }
    isIgnored(playerId) { return this.social.ignores.some((i) => i.playerId === playerId); }
    buddyRequestFrom(playerId) { return this.social.requests.find((r) => r.playerId === playerId && r.direction === 'received'); }

    // ---------- Processamento de pacotes ----------

    handlePacket(packet) {
        const { op, data } = packet;
        if (!op) return;

        switch (op) {
            case 'PLAYER_DATA':
                this._handlePlayerData(data);
                break;
            case 'NEED_CREATE':
                this.scene.events.emit('need-create-player');
                break;
            case 'PARTY_UPDATE':
                this.party = data?.party || null;
                this.scene.events.emit('party-update', data);
                break;
            case 'ERROR':
                // feedback de moderacao: toast generico (nunca expoe a palavra)
                if (['CHAT_FILTERED', 'CHAT_RATE_LIMITED', 'NAME_FILTERED', 'CARE_COOLDOWN'].includes(data?.code)) {
                    this._showDomToast(data.message || 'Ação não permitida', '#c0392b');
                }
                this.scene.events.emit('net-error', data);
                break;
            case 'SOCIAL_UPDATE':
                this.social = {
                    buddies: data.buddies || [],
                    requests: data.requests || [],
                    ignores: data.ignores || [],
                    pets: data.pets || [],
                    petSpecies: data.petSpecies || this.social.petSpecies
                };
                this.scene.events.emit('social-update', this.social);
                break;
            case 'BUDDY_REQUEST':
                // notificacao visual fica a cargo da cena (PromptUI prompt_mc)
                this.scene.events.emit('buddy-request', data);
                this.getSocial();
                break;
            case 'BUDDY_REQUEST_SENT':
                this.scene.events.emit('buddy-request-sent', data);
                break;
            case 'BUDDY_ACCEPTED':
                this.scene.events.emit('buddy-accepted', data);
                this.getSocial();
                break;
            case 'ITEM_BOUGHT':
                this._showDomToast(`Purchased ${data.name || 'item'}! Coins: ${data.coins}c`, '#b8860b');
                this.scene.events.emit('item-bought', data);
                break;
            case 'ROOM_STATE':
                this.scene.events.emit('room-state', data);
                break;
            case 'MOVE_PLAYER':
                this.scene.events.emit('player-move', data);
                break;
            case 'SEND_CHAT':
                this.scene.events.emit('player-chat', data);
                break;
            case 'EQUIP_ITEM':
                this.scene.events.emit('player-equip', data);
                break;
            case 'SET_COLOR':
                this.scene.events.emit('player-color', data);
                break;
            case 'PLAYER_ACTION':
                this.scene.events.emit('player-action', data);
                break;
            case 'PLAYER_JOINED':
                this.scene.events.emit('player-joined', data);
                break;
            case 'PLAYER_LEFT':
                this.scene.events.emit('player-left', data);
                break;
            case 'PLAYER_PET':
                this.scene.events.emit('player-pet', data);
                break;
            case 'PLAYER_PET_CARE':
                this.scene.events.emit('player-pet-care', data);
                break;
            default:
                this.scene.events.emit('packet-' + op, data);
                break;
        }
    }

    _handlePlayerData(data) {
        this.playerData = data;
        this.playerId = data.playerId;
        this.username = data.username;
        this.colorItemId = data.colorItemId || DEFAULT_COLOR_ITEM_ID;
        this.coins = data.coins || 0;
        this.inventory = data.inventory || [];
        this.equipped = data.equipped || {};
        this.canRename = data.canRename || false;
        this.party = data.party || null;
        this.dailyBonus = data.dailyBonus || 0;

        // Salva session token no localStorage para fallback
        if (data.sessionToken) {
            localStorage.setItem('penguin_session', data.sessionToken);
        }

        // Daily bonus creditado nesta sessão — notifica peak-a-peak (DOM,
        // independe de cena/HUD abertos)
        if (this.dailyBonus > 0) {
            this._showDomToast(`Daily bonus! +${this.dailyBonus} coins`, '#2fb344');
        }

        console.log('[NetworkClient] Player data recebido:', {
            playerId: this.playerId,
            username: this.username,
            coins: this.coins,
            inventoryCount: this.inventory.length
        });

        this.scene.events.emit('player-data', data);
        this.scene.events.emit('net-connected', { playerId: this.playerId });
        // carrega estado social apos autenticacao
        this.getSocial();
    }

    // Toast DOM simples — visível mesmo sem wardrobe/HUD abertos
    _showDomToast(message, color = '#0072ce') {
        if (typeof document === 'undefined') return;
        let host = document.getElementById('penguin-toasts');
        if (!host) {
            host = document.createElement('div');
            host.id = 'penguin-toasts';
            host.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:999999;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none;';
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.textContent = message;
        el.style.cssText = `background:${color};color:#fff;font:700 13px/1.4 Arial,sans-serif;padding:8px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.35);opacity:0;transition:opacity .25s;white-space:nowrap;`;
        host.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 3500);
    }

    // Helper para obter cor RGB atual
    getPenguinColor() {
        return colorItemToRgb(this.colorItemId);
    }

    // Helper para verificar se possui um item
    hasItem(itemId) {
        return this.inventory.some(i => i.itemId === itemId && i.quantity > 0);
    }

    // Helper para obter quantidade de um item
    getItemQuantity(itemId) {
        const item = this.inventory.find(i => i.itemId === itemId);
        return item ? item.quantity : 0;
    }
}
