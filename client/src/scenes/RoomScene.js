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
import Wardrobe from '../ui/Wardrobe.js';
import ActionControls from '../ui/ActionControls.js';
import WebHud from '../ui/WebHud.js';
import { MovieRoom } from '../movie/movie.js';
import PlayerCard from '../ui/PlayerCard.js';
import IslandMap from '../ui/IslandMap.js';
import VectorHud from '../ui/VectorHud.js';
import LoadingScreen from '../ui/LoadingScreen.js';
import { musicPlayer } from '../audio/MusicPlayer.js';
import CreatePlayerModal from '../ui/CreatePlayerModal.js';
import NameChangeModal from '../ui/NameChangeModal.js';
import { colorItemToRgb, DEFAULT_COLOR_ITEM_ID } from '../items/colors.js';
import { WORLD_W, WORLD_H, computeSupersample } from '../display.js';
import { RoomInteractions } from '../room/RoomInteractions.js';
import { CatalogueOverlay } from '../ui/Catalogue.js';
import { MinigameOverlay } from '../minigames/MinigameOverlay.js';

// salas do clone -> pacote /swf/<pack>/ vetorial (timelines.json + SVGs).
// Sem fallback: se o pack falhar, a sala mostra um retangulo de erro.
const MOVIE_ROOM_MAP = {
    town: 'town', coffee: 'coffee', dance: 'dance', pizza: 'pizza',
    plaza: 'plaza', forts: 'forts', dojo: 'dojo', beach: 'beach',
    dock: 'dock', lodge: 'lodge', mine: 'mine', rink: 'rink',
    // salas extras ligadas por triggers_mc das salas base
    shop: 'shop', book: 'book', boiler: 'boiler', lounge: 'lounge',
    pet: 'pet', cave: 'cave', stage: 'stage', forest: 'forest',
    light: 'light', ship: 'ship', village: 'village', attic: 'attic',
    dojoext: 'dojoext', cavemine: 'cavemine',
    // destinos do mapa da ilha (map.swf)
    mtn: 'mtn', cove: 'cove', shack: 'shack', berg: 'berg'
};

// nomes exibidos no loader ("Joining <sala>") — nomes do CP original
const ROOM_NAMES = {
    town: 'Town', coffee: 'Coffee Shop', dance: 'Dance Club', pizza: 'Pizzeria',
    plaza: 'Plaza', forts: 'Fort Rocks', dojo: 'Dojo', beach: 'Beach',
    dock: 'Dock', lodge: 'Iceberg', mine: 'Mine Shack', rink: 'Ice Rink',
    shop: 'Gift Shop', book: 'Book Room', boiler: 'Boiler Room', lounge: 'Lounge',
    pet: 'Pet Shop', cave: 'Cave', stage: 'Stage', forest: 'Forest',
    light: 'Lighthouse', ship: 'Ship', village: 'Village', attic: 'Attic',
    dojoext: 'Dojo', cavemine: 'Mine', mtn: 'Mountain', cove: 'Cove',
    shack: 'Mine Shack', berg: 'Iceberg'
};

// Cache de layers rasterizadas no IndexedDB: a primeira visita a uma sala
// rasteriza os SVGs (lento); as proximas carregam blobs prontos e a sala
// aparece quase instantaneamente. Chave inclui escala (supersampling) e
// fingerprint do pack para invalidar se os assets mudarem.
const LAYER_CACHE = 'penguin-movie-layers';
let _idbPromise = null;
function idb() {
    if (!_idbPromise) {
        _idbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('penguin-movie', 1);
            req.onupgradeneeded = () => req.result.createObjectStore(LAYER_CACHE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return _idbPromise;
}
async function idbGet(key) {
    try {
        const db = await idb();
        return await new Promise((res) => {
            const rq = db.transaction(LAYER_CACHE).objectStore(LAYER_CACHE).get(key);
            rq.onsuccess = () => res(rq.result || null);
            rq.onerror = () => res(null);
        });
    } catch { return null; }
}
async function idbPut(key, val) {
    try {
        const db = await idb();
        await new Promise((res) => {
            const tx = db.transaction(LAYER_CACHE, 'readwrite');
            tx.objectStore(LAYER_CACHE).put(val, key);
            tx.oncomplete = res; tx.onerror = res;
        });
    } catch { /* cache e best-effort */ }
}
function canvasToBlob(canvas) {
    return new Promise((res) => canvas.toBlob(res, 'image/webp', 0.92));
}

export default class RoomScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RoomScene' });
        this.network = null;
        this.localPlayer = null;
        this.remotePlayers = new Map();
        this.currentRoom = new URLSearchParams(location.search).get('room') || 'town';
        this.mapOpen = false;
        this.clothesOpen = false;
        this._ss = 2; // fator de supersampling inicial (ajustado por applySupersampling)
    }

    create() {
        const width = WORLD_W, height = WORLD_H;
        // Textos de UI em alta resolucao: Phaser.Text rasteriza com
        // resolution=1 por padrao e fica borrado quando o camera zoom/fit
        // amplia o mundo 760x480 — injeta SS_MAX no style de todo add.text
        const addText = this.add.text.bind(this.add);
        this.add.text = (x, y, text, style) =>
            addText(x, y, text, { resolution: 3, ...(style || {}) });
        // biblioteca vetorial do pinguim (promise iniciada no BootScene)
        this.penguinLibrary = this.game.penguinLibrary;

        // 1. Cena vetorial SWF (timelines.json + SVG) — unica fonte de cenario
        this.loadingScreen = new LoadingScreen(this);
        this._initMovie(this.currentRoom);
        musicPlayer.play(this.currentRoom);

        // 2. Conexão WebSocket (autenticação acontece antes do pinguim)
        this.network = new NetworkClient(this);
        this._playerReady = false;
        this.createPlayerModal = new CreatePlayerModal(this);
        this.nameChangeModal = new NameChangeModal(this);

        // Mostra loading durante autenticação
        this.loadingScreen?.show('Connecting to Club Penguin...', 0.1);

        // Configura eventos de autenticação antes de criar o pinguim
        this._setupAuthEvents();

        // 3. Pinguim do Jogador Local será criado quando player-data chegar
        this.localPlayer = null;
        this._pendingSpawn = { x: width / 2, y: height * 0.65 };

        // posicao do ponteiro em coords de mundo — pinguim "olha" para ela
        this._pointerWorld = { x: width / 2, y: height * 0.65 - 60 };
        this.input.on('pointermove', (pointer) => {
            this._pointerWorld = { x: pointer.worldX, y: pointer.worldY };
            if (this.catalogue?.promptOpen) return;
            if (this.catalogue?.isOpen) { this.catalogue.hoverAt(pointer.worldX, pointer.worldY); return; }
            if (this.localPlayer) this.localPlayer.facePoint(pointer.worldX, pointer.worldY);
            this._interactions?.hoverAt(pointer.worldX, pointer.worldY);
        });

        // 4. Click-to-Move no Cenário
        this.input.on('pointerdown', (pointer) => {
            // Aguarda autenticação do jogador
            if (!this._playerReady || !this.localPlayer) return;
            
            // clique que fechou o player card/guarda-roupa nao vira movimento
            if (this._pcardClosedAt && this.time.now - this._pcardClosedAt < 200) return;
            if (this._wardrobeClosedAt && this.time.now - this._wardrobeClosedAt < 200) return;
            if (this._promptClosedAt && this.time.now - this._promptClosedAt < 200) return;
            const wy = pointer.worldY;
            if (this.mapOpen || this.clothesOpen || this.wardrobe?.isOpen) return;

            // worldX/worldY aplicam o transform da camera (zoom/scroll do supersampling)
            const wx = pointer.worldX;

            // prompt de compra/aviso e modal: cliques nele nao chegam a sala
            // nem ao catalogo (as zones do prompt ja tratam o proprio clique)
            if (this.catalogue?.promptOpen) return;

            // catalogo aberto: cliques vao para ele, nao para a sala
            if (this.catalogue?.isOpen) { this.catalogue.clickAt(wx, wy); return; }

            // botoes de conteudo do cenario (ex.: clothing_btn da Gift Shop)
            // ficam na faixa inferior junto ao HUD — resolvem antes do
            // bloqueio de clique na area do dock, senao nunca abrem
            const btnDest = this._interactions?.clickTarget(wx, wy);
            if (btnDest?.content) { this.openContent(btnDest.content); return; }
            if (btnDest?.game) { this._showGameUnavailable(btnDest.game); return; }

            if (wy > (this.gpHud ? this.gpHud.blockY : height - 60)) return;
            const hits = this.input.hitTestPointer(pointer)
                .filter((obj) => obj && obj.input && obj.input.enabled);
            if (hits.length > 0) return;

            // clique em cima de um pinguim abre o player card (nao anda)
            const clicked = this._penguinAt(wx, wy);
            if (clicked) { this.playerCard.open(clicked); return; }
            const targetX = btnDest ? btnDest.x : Math.round(wx);
            const targetY = btnDest ? btnDest.y : Math.round(wy);

            // colisao + saidas entre salas (block_mc/triggers_mc do pack SWF)
            let dest = { x: targetX, y: targetY };
            if (this.movie && this.movie._block) {
                dest = this.movie.findPath(this.localPlayer.x, this.localPlayer.y, targetX, targetY);
            }
            const dx = dest.x - this.localPlayer.x, dy = dest.y - this.localPlayer.y;
            if (Math.hypot(dx, dy) < 4) return;
            this.localPlayer.moveTo(dest.x, dest.y, 150, () => {
                // ao terminar o deslocamento, volta a "olhar" para o cursor
                if (this._pointerWorld) {
                    this.localPlayer.facePoint(this._pointerWorld.x, this._pointerWorld.y);
                }
                const exit = this.movie && this.movie.triggerAt(this.localPlayer.x, this.localPlayer.y);
                if (exit?.content) { this.openContent(exit.content); return; }
                if (exit?.game) { this._showGameUnavailable(exit.game); return; }
                if (exit && exit.room && MOVIE_ROOM_MAP[exit.room] && exit.room !== this.currentRoom) {
                    this.changeRoom(exit.room, exit.x, exit.y);
                }
            });
            this.network.sendMove(dest.x, dest.y);
        });

        // 5. Configurar Eventos da Rede
        this.setupNetworkEvents();

        // 6. Criar HUD Autêntica (Idêntica à imagem do GoPenguin)
        this.createAuthenticHUD();

        // 6b. Controles de ação clássicos (X dance, Y wave, B sentar, C/V bolinha)
        this.actionControls = new ActionControls(this, {
            onAction: (name) => this.handleAction(name)
        });
        this.catalogue = new CatalogueOverlay(this);

        // 6c. Player card (clique no pinguim abre perfil)
        this.playerCard = new PlayerCard(this);
        this.wardrobe = new Wardrobe(this);
        this.wardrobe.onClose = () => { this.clothesOpen = false; };

        // 7. Modal do Mapa da Ilha e guarda-roupa
        this.createMapModal();
        // guarda-roupa vetorial fica a cargo do Wardrobe (player card)

        // 8. Entrada na sala (aguarda player-data)
        this.events.on('net-connected', () => {
            if (this._playerReady && this.localPlayer) {
                this.network.joinRoom(this.currentRoom, this.localPlayer.x, this.localPlayer.y);
            }
        });

        // 9. Supersampling adaptativo: backing = 760x480 * fator SS,
        // camera zoom = SS mostra o mundo 760x480 nítido em qualquer tela
        this.applySupersampling();
        // re-aplica apos o primeiro layout/resize do ScaleManager
        this.time.delayedCall(100, () => this.applySupersampling());
        this.scale.on('resize', () => this.applySupersampling());
    }

    // Ajusta backing store + camera zoom conforme viewport/devicePixelRatio.
    // WS: mundo segue em coords 760x480 — HUD, input e movimento não mudam.
    applySupersampling() {
        const ss = computeSupersample();
        const changed = ss !== this._ss;
        this._ss = ss;
        if (changed) this.scale.setGameSize(WORLD_W * ss, WORLD_H * ss);
        // zoom/centerOn sao idempotentes — garante o estado mesmo em chamadas
        // que nao mudaram o fator (ex.: resize do window antes do primeiro paint)
        this.cameras.main.setZoom(ss);
        this.cameras.main.centerOn(WORLD_W / 2, WORLD_H / 2);
        if (changed) {
            // textos Phaser precisam re-rasterizar na nova resolucao —
            // sem isso ficam borrados quando o zoom/fit amplia o mundo
            this.game.config.resolution = ss;
            this._rescaleTexts(ss);
            // camadas movie precisam ser re-rasterizadas na nova resolucao
            if (this.movie) {
                this.movie.setScale(ss);
                this._buildMovieLayers();
                this.movie.buildCollision(ss).catch(() => {});
            }
        }
    }

    // Percorre a display list (inclui containers) e ajusta a resolucao de
    // todos os Phaser.Text — equivalente ao supersampling das texturas SWF.
    _rescaleTexts(ss) {
        const walk = (parent) => {
            const kids = parent?.list || (parent?.children?.list);
            if (!kids) return;
            for (const ch of kids) {
                if (ch?.type === 'Text') ch.setResolution(ss);
                if (ch?.list || ch?.children?.list) walk(ch);
            }
        };
        walk(this.children);
    }

    // Configura eventos de autenticação e criação de jogador
    _setupAuthEvents() {
        // Servidor retornou NEED_CREATE - abrir modal de criação
        this.events.on('need-create-player', () => {
            this.loadingScreen?.hide();
            this.createPlayerModal.open();
        });

        // Dados do jogador recebidos - criar pinguim local ou atualizar
        this.events.on('player-data', (data) => {
            // Se o nameChangeModal estiver aberto, é uma resposta de rename
            if (this.nameChangeModal?.isOpen) {
                this.nameChangeModal.onServerResponse(true);
                // Atualiza username no pinguim local
                if (this.localPlayer) {
                    this.localPlayer.username = data.username;
                    this.localPlayer.nameTag.setText(data.username);
                }
                return;
            }
            
            if (this._playerReady) return; // já inicializado
            this._playerReady = true;
            // so esconde o loader se a sala ja terminou de carregar —
            // antes disso o hide() revelava a town parcialmente rasterizada
            if (this._movieReady) this.loadingScreen?.hide();
            this.createPlayerModal?.onServerResponse?.(true);
            this._initLocalPlayer(data);
        });

        // Erros de rede
        this.events.on('net-error', (data) => {
            console.warn('[RoomScene] Net error:', data);
            if (data.code === 'NEED_CREATE') {
                this.loadingScreen?.hide();
                this.createPlayerModal.open();
            } else if (data.code === 'CREATE_FAILED') {
                this.createPlayerModal?.onServerResponse?.(false, data.message);
            } else if (data.code === 'RENAME_FAILED') {
                this.nameChangeModal?.onServerResponse?.(false, data.message);
            } else {
                // Erro genérico - mostra no chat ou alert
                this.localPlayer?.showChat?.(`Erro: ${data.message || 'Erro de conexão'}`);
            }
        });

        // Inventário atualizado (após compra)
        this.events.on('inventory-update', (data) => {
            this._updateCoinsDisplay();
        });
    }

    // Cria o pinguim local com dados do servidor
    async _initLocalPlayer(data) {
        const startX = WORLD_W / 2;
        const startY = WORLD_H * 0.65;

        // O inventario/outfit vem do servidor (Arenovisk tem all_items).

        this.localPlayer = new Penguin(
            this,
            startX,
            startY,
            data.playerId,
            data.username,
            data.colorItemId || DEFAULT_COLOR_ITEM_ID,
            true
        );

        // Aplica outfit equipado do servidor
        if (data.equipped) {
            this.localPlayer.applyOutfit(data.equipped);
        }

        window.__penguin = this.localPlayer; // debug
        this._updateCoinsDisplay();
        this._showGuestIndicator();

        // Se já estava autenticado, entra na sala
        if (this.network.isConnected) {
            this.network.joinRoom(this.currentRoom, startX, startY);
        }
    }

    // Atualiza display de coins (HUD)
    _updateCoinsDisplay() {
        const coins = this.network?.coins || 0;
        // TODO: implementar display de coins no HUD
        console.log('[RoomScene] Coins:', coins);
    }

    // Mostra indicador de guest mode
    _showGuestIndicator() {
        if (this._guestIndicator) return;
        const text = this.add.text(WORLD_W - 10, 10, 'Guest Mode', {
            fontFamily: 'GoPenguin, Arial, sans-serif',
            fontSize: '10px',
            color: '#ffffff',
            backgroundColor: '#0072ce',
            padding: { x: 6, y: 3 },
        }).setOrigin(1, 0).setDepth(10000001);
        this._guestIndicator = text;
    }

    setupNetworkEvents() {
        this.events.on('room-state', (data) => {
            if (!data || !data.players) return;
            this.clearRemotePlayers();
            data.players.forEach(p => {
                if (p.playerId !== this.network.playerId) {
                    this.upsertRemotePlayer(p.playerId, p.x, p.y, p.colorItemId, p.paperdoll, p.username);
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
                if (this.localPlayer) this.localPlayer.showChat(data.message);
            } else {
                const penguin = this.remotePlayers.get(data.playerId);
                if (penguin) {
                    penguin.showChat(data.message);
                }
            }
        });

        this.events.on('player-joined', (data) => {
            if (!data || data.playerId === this.network.playerId) return;
            this.upsertRemotePlayer(data.playerId, data.x, data.y, data.colorItemId, data.paperdoll, data.username);
        });

        this.events.on('player-equip', (data) => {
            if (!data || data.playerId === this.network.playerId) return;
            const penguin = this.remotePlayers.get(data.playerId)
                || this.upsertRemotePlayer(data.playerId, 380, 300, null, data.paperdoll);
            if (data.paperdoll) penguin.applyOutfit(data.paperdoll);
            else penguin.equip(data.slot, data.itemId);
        });

        this.events.on('player-color', (data) => {
            if (!data || data.playerId === this.network.playerId) return;
            const penguin = this.remotePlayers.get(data.playerId);
            if (penguin && data.colorItemId) penguin.setColorItemId(data.colorItemId);
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

    // Retorna o pinguim (local ou remoto) sob o ponto, ou null.
    // Hit box = bounds da arte vetorial (lib.bounds em coords do container).
    _penguinAt(wx, wy) {
        const candidates = [this.localPlayer, ...this.remotePlayers.values()]
            .filter((p) => p && p.view && p._lib);
        let best = null, bestD = Infinity;
        for (const p of candidates) {
            const b = p._lib.bounds;
            const hw = (b.x1 - b.x0) * 0.45, hh = (b.y1 - b.y0) * 0.55;
            const cx = p.x + (b.x0 + b.x1) / 2, cy = p.y + (b.y0 + b.y1) / 2;
            const dx = (wx - cx) / hw, dy = (wy - cy) / hh;
            const d = dx * dx + dy * dy;
            if (d <= 1 && d < bestD) { best = p; bestD = d; }
        }
        return best;
    }

    upsertRemotePlayer(playerId, x = 380, y = 300, colorItemId = null, paperdoll = null, username = null) {
        let penguin = this.remotePlayers.get(playerId);
        if (!penguin) {
            const colorId = colorItemId || DEFAULT_COLOR_ITEM_ID;
            penguin = new Penguin(this, x, y, playerId, username || playerId, colorId);
            this.remotePlayers.set(playerId, penguin);
        }
        if (paperdoll) penguin.applyOutfit(paperdoll);
        if (colorItemId) penguin.setColorItemId(colorItemId);
        return penguin;
    }

    handleAction(name) {
        if (!this._playerReady || !this.localPlayer) return;
        switch (name) {
            case 'dance': this.localPlayer.playEmote('dance'); break;
            case 'wave': this.localPlayer.playEmote('wave'); break;
            case 'throw': this.localPlayer.playEmote('throw'); break;
            case 'sit': this.localPlayer.sit(); break;
            case 'stand': this.localPlayer.stand(); break;
            case 'map': this.toggleMap(); break;
            case 'clothes': this.toggleClothes(); break;
        }
    }

    createAuthenticHUD() {
        // HUD vetorial do Club Penguin (dock_mc + icons_mc do interface.swf)
        this.gpHud = new VectorHud(this).setDepth(10000000); // acima dos segmentos SWL (max ~900001)
        this.gpHud.onButton((id) => this.handleHudButton(id));

        // remove inputs de chat de scenes anteriores (restart vaza elementos DOM)
        document.querySelectorAll('input.cp-chat-input').forEach((el) => el.remove());
        // Input de chat DOM sobre o pill central do dock
        const chatInput = document.createElement('input');
        chatInput.type = 'text';
        chatInput.className = 'cp-chat-input';
        chatInput.placeholder = '';
        Object.assign(chatInput.style, {
            position: 'fixed',
            border: 'none', outline: 'none',
            background: 'transparent',
            color: '#ffffff',
            fontFamily: "'GoPenguin', Arial, sans-serif",
            fontSize: '14px',
            zIndex: '9999',
            boxSizing: 'border-box',
            display: 'none',
        });
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const text = chatInput.value.trim();
                if (text) { this.network.sendChat(text); chatInput.value = ''; }
            } else if (e.key === 'Escape') {
                chatInput.blur();
            }
        });
        document.body.appendChild(chatInput);
        this.chatInputRef = chatInput;
        this._layoutChatInput();
        this.scale.on('resize', () => this._layoutChatInput());
        // o rect real do chat_mc so existe depois do build async do VectorHud
        this.events.on('vectorhud:ready', () => this._layoutChatInput());
        this.events.once('shutdown', () => chatInput.remove());
        this.events.once('shutdown', () => musicPlayer.stop());
        this.events.once('shutdown', () => this._minigame?.close());
    }

    // posiciona o input DOM sobre o pill do dock (canvas e escalado via FIT)
    _layoutChatInput() {
        if (!this.chatInputRef || this._chatLayoutQueued) return;
        // adia para o proximo frame: getBoundingClientRect forca reflow
        // sincrono se o layout estiver sujo — rAF deixa o browser batchar
        this._chatLayoutQueued = true;
        requestAnimationFrame(() => {
            this._chatLayoutQueued = false;
            if (!this.chatInputRef) return;
            // le o rect fresco: o VectorHud so conhece o chat_mc depois do build async
            const r = this.gpHud?.chatPillRect?.();
            if (!r) return;
            const rect = this.game.canvas.getBoundingClientRect();
            const sx = rect.width / 760, sy = rect.height / 480;
            Object.assign(this.chatInputRef.style, {
                display: 'block',
                left: (rect.left + r.x * sx + 6) + 'px',
                top: (rect.top + r.y * sy + 3) + 'px',
                width: (r.w * sx - 12) + 'px',
                height: (r.h * sy - 6) + 'px',
            });
        });
    }

    handleHudButton(id) {
        switch (id) {
            case 'chat':
            case 'quickchat':
                if (this.chatInputRef) { this._layoutChatInput(); this.chatInputRef.focus(); }
                break;
            case 'actions':
                this.handleAction('dance');
                break;
            case 'snowball':
                this.handleAction('throw');
                break;
            case 'map':
                this.toggleMap();
                break;
            case 'igloo':
                this.toggleClothes();
                break;
            case 'help':
                this.localPlayer && this.localPlayer.showChat('Precisa de ajuda? Visite a seccao Help!');
                break;
            case 'playercard':
                this.playerCard?.open(this.localPlayer);
                break;
            default:
                this.localPlayer && this.localPlayer.showChat(id);
        }
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

    // Mapa da ilha: painel vetorial map.swf (IslandMap) — substitui o grid antigo
    createMapModal() {
        this.islandMap = new IslandMap(this);
    }

    toggleMap() {
        if (!this.mapOpen && this.clothesOpen) this.toggleClothes();
        if (this.playerCard?.isOpen) this.playerCard.close();
        this.mapOpen = !this.mapOpen;
        this.islandMap?.setOpen(this.mapOpen);
    }

    toggleClothes() {
        if (!this._playerReady || !this.localPlayer) return;
        if (this.wardrobe?.isOpen) { this.wardrobe.close(); return; }
        if (this.mapOpen) this.toggleMap();
        // abre wardrobe ao lado do player card (sem fechar o card)
        if (!this.playerCard?.isOpen) this.playerCard?.open(this.localPlayer);
        this.clothesOpen = true;
        this.wardrobe.open(this.localPlayer);
    }

    // Carrega o pacote vetorial /assets/movies/<pack>/ (timelines.json + SVGs).
    // Sem fallback: se o pack nao carregar, mostra retangulo de erro.
    _initMovie(roomKey) {
        this._clearMovie();
        const pack = MOVIE_ROOM_MAP[roomKey];
        if (this.roomFailText) { this.roomFailText.destroy(); this.roomFailText = null; }
        if (!pack) { this._showRoomFail(roomKey); return; }
        this._movieReady = false;
        this.loadingScreen?.show(`Joining ${ROOM_NAMES[roomKey] || roomKey}...`, 0);
        MovieRoom.load(`/assets/movies/${pack}`)
            .then(async (movie) => {
                if (this.currentRoom !== roomKey) { return; } // sala trocou durante o load
                this.movie = movie;
                this.movie.setScale(this._ss);
                // cria playheads sem rasterizar — sem isso, rooms vindos do
                // cache IndexedDB ficavam com animacao congelada
                movie.warmPlayheads();
                // interacoes de cenario (botoes up/over/down + walk-to-door)
                this._interactions = new RoomInteractions(this, movie, roomKey);
                this._interactions.build();
                // decode de SVG e lazy (artCanvas/_svgImage sob demanda durante
                // renderLayer): decodificar TODOS os arquivos do pack saturava a
                // main thread (~900ms de image.onload no trace) e a maioria
                // nunca era usada.
                this._buildMovieLayers();
                // bitmap de colisao (block_mc) + zonas de saida (triggers_mc)
                // atrasado para nao competir com o primeiro render das layers
                this.time.delayedCall(1500, () => {
                    if (this.movie === movie) movie.buildCollision(this._ss)
                        .catch((e) => console.warn('[movie] buildCollision', e));
                });
                // progresso da barra: fatia inicial pelo pack carregado,
                // o resto pelas layers rasterizadas
                const total = this.movieLayers.length;
                this.loadingScreen?.setProgress(0.15);
                const report = (done) => this.loadingScreen?.setProgress(0.15 + 0.85 * (done / total));
                // Tenta cache IndexedDB das layers ja rasterizadas (mesma
                // sala + mesma escala + mesmo pack). Hit = sala instantanea.
                const cacheKey = `v1|${pack}|ss${this._ss.toFixed(2)}|${movie.fingerprint()}`;
                const cached = await idbGet(cacheKey);
                let cacheHit = false;
                if (this.movie !== movie) return;
                if (cached?.blobs?.length === this.movieLayers.length) {
                    cacheHit = true;
                    for (let i = 0; i < this.movieLayers.length; i++) {
                        const layer = this.movieLayers[i];
                        try {
                            const bmp = await createImageBitmap(cached.blobs[i]);
                            layer.canvas.getContext('2d').drawImage(bmp, 0, 0);
                            bmp.close();
                        } catch { /* blob corrompido: cai no render normal */ }
                        layer.tex?.refresh();
                    }
                }
                // revela a sala somente com todas as layers prontas —
                // as layers nascem invisiveis, entao nenhum pixel parcial
                // aparece mesmo se outro evento esconder o loader antes
                const reveal = () => {
                    if (this.movie !== movie) return;
                    for (const layer of this.movieLayers) layer.img.setVisible(true);
                    this._movieReady = true;
                    this.loadingScreen?.hide();
                    // garante que o pinguim está em posição acessível
                    this._applySafeSpawn();
                };
                // Rasteriza as layers EM SEQUENCIA com yields: renderizar
                // todas em paralelo saturava a main thread (tela preta por
                // minutos + screenshot/browser travando). Sequencial mostra
                // o cenario progressivamente e mantem a UI responsiva.
                const boot = async () => {
                    let done = 0;
                    for (const layer of this.movieLayers) {
                        if (this.movie !== movie) return; // sala trocou
                        if (layer._busy) { await new Promise((r) => setTimeout(r, 30)); continue; }
                        layer._busy = true;
                        try {
                            await movie.renderLayer(layer.entry, layer.canvas, this._ss);
                        } catch (e) {
                            console.warn('[movie] renderLayer', e);
                        } finally {
                            layer.tex?.refresh();
                            layer._busy = false;
                        }
                        done++;
                        report(done);
                        await new Promise((r) => setTimeout(r, 0));
                    }
                    // salva no cache para a proxima visita (so se nao houve hit)
                    if (!cacheHit && this.movie === movie) {
                        const blobs = [];
                        for (const layer of this.movieLayers) {
                            blobs.push(await canvasToBlob(layer.canvas));
                        }
                        if (blobs.every(Boolean) && this.movie === movie) {
                            idbPut(cacheKey, { blobs, ts: Date.now() });
                        }
                    }
                    reveal();
                };
                if (!cacheHit) boot(); else reveal();
                const frame = () => {
                    movie.tick();
                    // re-render so das layers com playhead ativo no frame —
                    // antes re-renderizava TUDO a cada tick (salas animadas
                    // ficavam injogaveis de tanto rasterizar)
                    const targets = this.movieLayers.filter((l) => movie._dirtyRoots.has(l.rootKey));
                    if (targets.length === 0) return;
                    for (const layer of targets) {
                        if (layer._busy) continue; // renderLayer async nao pode sobrepor
                        layer._busy = true;
                        layer.movie.renderLayer(layer.entry, layer.canvas, this._ss)
                            .catch((e) => console.warn('[movie] renderLayer', e))
                            .then(() => layer.tex?.refresh())
                            .finally(() => { layer._busy = false; });
                    }
                };
                this.movieTimer = this.time.addEvent({ delay: 1000 / movie.rate, loop: true, callback: frame });
            })
            .catch((e) => {
                console.warn('[movie] falha ao carregar pack', pack, e);
                if (this.currentRoom === roomKey) this._showRoomFail(roomKey);
            });
    }

    // Sala vetorial indisponivel: cor lisa + aviso, em vez de PNG/SWL com
    // zonas de trigger e areas inacessiveis visiveis.
    // INTERFACE.showContent("X") do AS das salas: catalogos abrem o viewer,
    // demais conteudos (binoculars etc.) ainda nao implementados.
    openContent(name) {
        if (name.endsWith('_catalogue')) {
            this.catalogue?.open(name);
        } else {
            this._contentNotice(`${name} (em breve)`);
        }
    }

    _showGameUnavailable(game) {
        if (!this._minigame) this._minigame = new MinigameOverlay(this);
        if (this._minigame.open(game)) {
            musicPlayer.stop();
            this._minigameRoom = this.currentRoom;
            return;
        }
        this._contentNotice(`${game} (minigame em breve)`);
    }

    _closeMinigame() {
        if (!this._minigame?.isOpen) return;
        this._minigame.close();
        if (this._minigameRoom) musicPlayer.play(this._minigameRoom);
        this._minigameRoom = null;
    }

    _contentNotice(text) {
        if (this._noticeText) this._noticeText.destroy();
        this._noticeText = this.add.text(WORLD_W / 2, 60, text, {
            fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#fff',
            backgroundColor: '#000000aa', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setDepth(999998);
        this.time.delayedCall(2500, () => { this._noticeText?.destroy(); this._noticeText = null; });
    }

    _showRoomFail(roomKey) {
        this.loadingScreen?.hide();
        this.cameras.main.setBackgroundColor(0x263238);
        this.roomFailText = this.add.text(WORLD_W / 2, WORLD_H / 2,
            `Failed to load room "${roomKey}"\n(missing/corrupt SWF pack)`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            color: '#eceff1',
            align: 'center',
            lineSpacing: 6,
        }).setOrigin(0.5).setDepth(950000);
    }

    _buildMovieLayers() {
        if (!this.movie) return;
        for (const layer of this.movieLayers || []) {
            layer.img.destroy();
            if (this.textures.exists(layer.texKey)) this.textures.remove(layer.texKey);
        }
        this.movieLayers = [];
        const cw = Math.round(WORLD_W * this._ss), ch = Math.round(WORLD_H * this._ss);
        this.movie.topLevelLayers().forEach((l, i) => {
            const canvas = document.createElement('canvas');
            canvas.width = cw; canvas.height = ch;
            const texKey = `movie_view_${this.movie.base.split('/').pop()}_${i}`;
            if (this.textures.exists(texKey)) this.textures.remove(texKey);
            const tex = this.textures.addCanvas(texKey, canvas);
            const img = this.add.image(WORLD_W / 2, WORLD_H / 2, texKey)
                .setDisplaySize(WORLD_W, WORLD_H)
                .setDepth(l.z + i * 0.001)
                .setVisible(false); // so aparece quando a sala termina de carregar
            this.movieLayers.push({
                movie: this.movie, entry: l.entry, canvas, texKey, tex, img,
                rootKey: l.entry.name || `#${l.entry.depth}`,
            });
        });
    }

    _clearMovie() {
        this.catalogue?.close();
        if (this.movieTimer) { this.movieTimer.remove(); this.movieTimer = null; }
        if (this.movieLayers) {
            for (const layer of this.movieLayers) {
                layer.img.destroy();
                if (this.textures.exists(layer.texKey)) this.textures.remove(layer.texKey);
            }
            this.movieLayers = null;
        }
        this.movie = null;
        this._interactions = null;
        this.cameras.main.setBackgroundColor(0x000000);
    }

    changeRoom(newRoomKey, spawnX = null, spawnY = null) {
        if (this.currentRoom === newRoomKey) return;
        if (!this._playerReady || !this.localPlayer) return;
        this.playerCard?.close();
        this._closeMinigame();
        this.currentRoom = newRoomKey;
        this._clearMovie();
        this._initMovie(newRoomKey);
        musicPlayer.play(newRoomKey);

        // guarda a posição desejada; o safe spawn é aplicado quando o movie carregar
        this._pendingSpawn = { x: spawnX, y: spawnY };
        const startX = spawnX ?? WORLD_W / 2;
        const startY = spawnY ?? WORLD_H * 0.65;
        this.localPlayer.setPosition(startX, startY);
        this.localPlayer.updateDepth();

        this.clearRemotePlayers();
        this.network.joinRoom(newRoomKey, startX, startY);

        if (this.mapOpen) {
            this.toggleMap();
        }
    }

    // Aplica posição segura após o movie carregar (colisão disponível)
    _applySafeSpawn() {
        if (!this.movie || !this.localPlayer) return;
        const desired = this._pendingSpawn || { x: WORLD_W / 2, y: WORLD_H * 0.65 };
        const safe = this.movie.findSafeSpawn(desired.x ?? WORLD_W / 2, desired.y ?? WORLD_H * 0.65);
        if (safe.x !== this.localPlayer.x || safe.y !== this.localPlayer.y) {
            this.localPlayer.setPosition(safe.x, safe.y);
            this.localPlayer.updateDepth();
            // atualiza posição no servidor
            this.network?.sendMove?.(safe.x, safe.y);
        }
        this._pendingSpawn = null;
    }
}
