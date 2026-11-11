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
import { PenguinLibrary } from '../entities/PenguinArt.js';
import Wardrobe from '../ui/Wardrobe.js';
import ActionControls from '../ui/ActionControls.js';
import WebHud from '../ui/WebHud.js';
import { MovieRoom, IDENT_COLOR } from '../movie/movie.js';
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
            // camadas movie precisam ser re-rasterizadas na nova resolucao.
            // _buildMovieLayers recria imgs invisiveis — sem re-render+reveal
            // a sala ficava SOME (bug: so o proximo _initMovie re-exibia)
            if (this.movie) {
                this.movie.setScale(ss);
                this._buildMovieLayers();
                (async () => {
                    const mv = this.movie;
                    for (const seg of this.movieLayers) {
                        if (this.movie !== mv) return;
                        try {
                            await this._renderSegment(seg);
                        } catch (e) { console.warn('[seg] render ss', e); }
                        seg.tex?.refresh();
                    }
                    if (this.movie !== mv) return;
                    await this._renderDynamics(mv);
                    if (this.movie !== mv) return;
                    for (const seg of this.movieLayers) seg.img.setVisible(true);
                })();
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

    setupNetworkEvents() {
        this.events.on('room-state', (data) => {
            if (!data || !data.players) return;
            this.clearRemotePlayers();
            data.players.forEach(p => {
                if (p.playerId !== this.network.playerId) {
                    this.upsertRemotePlayer(p.playerId, p.x, p.y, p.colorItemId, p.paperdoll, p.username, p.action);
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
            this.upsertRemotePlayer(data.playerId, data.x, data.y, data.colorItemId, data.paperdoll, data.username, data.action);
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

        // Acao/emote de outro jogador (dance, wave, sit...) — para o
        // movimento e aplica o frame correspondente no pinguim remoto.
        this.events.on('player-action', (data) => {
            if (!data || data.playerId === this.network.playerId) return;
            const penguin = this.remotePlayers.get(data.playerId);
            if (!penguin) return;
            if (penguin.moveTween) {
                penguin.moveTween.stop();
                penguin.moveTween = null;
                penguin.isMoving = false;
                penguin.moveTarget = null;
            }
            switch (data.action) {
                case 'dance':
                case 'wave':
                case 'throw': penguin.playEmote(data.action); break;
                case 'sit': penguin.sit(); break;
                case 'stand':
                case 'idle':
                default: penguin.stand(); break;
            }
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

    upsertRemotePlayer(playerId, x = 380, y = 300, colorItemId = null, paperdoll = null, username = null, action = null) {
        let penguin = this.remotePlayers.get(playerId);
        if (!penguin) {
            const colorId = colorItemId || DEFAULT_COLOR_ITEM_ID;
            penguin = new Penguin(this, x, y, playerId, username || playerId, colorId);
            this.remotePlayers.set(playerId, penguin);
        }
        if (paperdoll) penguin.applyOutfit(paperdoll);
        if (colorItemId) penguin.setColorItemId(colorItemId);
        // estado de acao atual (ex.: dançando ao entrar na sala)
        if (action && ['dance', 'wave', 'throw', 'sit', 'stand', 'idle'].includes(action)) {
            if (action === 'sit') penguin.sit();
            else if (action === 'stand' || action === 'idle') penguin.stand();
            else penguin.playEmote(action);
        }
        return penguin;
    }

    handleAction(name) {
        if (!this._playerReady || !this.localPlayer) return;
        // emotes/acoes do pinguim -> sincroniza nos outros clientes da sala
        if (['dance', 'wave', 'throw', 'sit', 'stand', 'idle'].includes(name)) {
            this.network?.sendAction?.(name);
        }
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
        // wardrobe e acoplado ao player card: se o card esta fechado,
        // o inventario permanece fechado tambem (nao abre o card sozinho)
        if (!this.playerCard?.isOpen) return;
        this.clothesOpen = true;
        this.wardrobe.open(this.localPlayer);
    }

    // Bases das salas alcancaveis pelas saidas da sala atual — candidatas
    // ao prefetch de decode (provavel proximo destino do jogador).
    _adjacentBases() {
        const out = new Set();
        for (const ex of Object.values(this.movie?.exits || {})) {
            const pack = ex.room && MOVIE_ROOM_MAP[ex.room];
            if (pack) out.add(`/assets/movies/${pack}`);
        }
        return out;
    }

    // Apos o reveal: baixa os packs das salas ainda nao visitadas, uma por
    // idle callback (modelo de prefetch do gopenguin.lol). O manifest e
    // parseado em worker; packs vao para o IDB — proxima visita sai quente.
    // Salas adjacentes (exits) tem prioridade na fila. Decode-prefetch de
    // SVG foi avaliado e revertido: o browser decodifica ~5-15 SVG/s e o
    // backlog FIFO atrasava a entrada na sala (~40s vs ~12s cold) — packs
    // no IDB ja bastam; o decode acontece no load como sempre.
    // Re-executavel a cada troca de sala: _prefetchDone deduplica.
    _prefetchRoomsIdle() {
        if (this._prefetchRunning) return;
        this._prefetchRunning = true;
        const done = this._prefetchDone || (this._prefetchDone = new Set());
        const adjacent = this._adjacentBases();
        const all = [...new Set(
            Object.values(MOVIE_ROOM_MAP).map((p) => `/assets/movies/${p}`))];
        const ordered = [
            ...all.filter((b) => adjacent.has(b)),
            ...all.filter((b) => !adjacent.has(b)),
        ];
        const sched = typeof requestIdleCallback === 'function'
            ? (fn) => requestIdleCallback(fn, { timeout: 8000 })
            : (fn) => setTimeout(fn, 300);
        let i = 0;
        const roomAtStart = this.currentRoom;
        const step = () => {
            while (i < ordered.length && done.has(ordered[i])) i++;
            const b = ordered[i++];
            if (b === undefined) {
                this._prefetchRunning = false;
                // sala trocou durante o loop: re-avalia adjacentes da sala nova
                if (this.currentRoom !== roomAtStart) this._prefetchRoomsIdle();
                return;
            }
            done.add(b);
            MovieRoom.prefetchRoom(b)
                .catch(() => {})
                .finally(() => sched(step));
        };
        sched(step);
    }

    // Carrega o pacote vetorial /assets/movies/<pack>/ (timelines.json + SVGs).
    // Sem fallback: se o pack nao carregar, mostra retangulo de erro.
    _initMovie(roomKey) {
        this._clearMovie();
        const pack = MOVIE_ROOM_MAP[roomKey];
        if (this.roomFailText) { this.roomFailText.destroy(); this.roomFailText = null; }
        if (!pack) { this._showRoomFail(roomKey); return; }
        this._movieReady = false;
        // pausa o decode agendado de fundo (prefetch idle de outras salas)
        // ate esta sala estar pronta — sem isso o cold load competia com
        // ~10 chains de decode e a entrada ficava PIOR que sem prefetch
        MovieRoom._decodeHold++;
        const releaseHold = () => { MovieRoom._decodeHold = Math.max(0, MovieRoom._decodeHold - 1); };
        this.loadingScreen?.show(`Joining ${ROOM_NAMES[roomKey] || roomKey}...`, 0);
        MovieRoom.load(`/assets/movies/${pack}`)
            .then(async (movie) => {
                if (this.currentRoom !== roomKey) { releaseHold(); return; } // sala trocou durante o load
                this.movie = movie;
                this.movie.setScale(this._ss);
                // cria playheads sem rasterizar — sem isso, rooms vindos do
                // cache IndexedDB ficavam com animacao congelada
                movie.warmPlayheads();
                // decode paralelo de todos os SVGs do pack: sem isso cada
                // renderLayer esperava um decode por vez (~60s na town)
                movie.prefetchSvgs();
                // sprites animados viram overlays proprios: as layers ficam
                // estaticas (1 render + 0 uploads por frame) e so os
                // overlays pequenos atualizam por tick
                await this._setupDynamics(movie);
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
                // v3: cache inclui os overlays dinamicos — sem eles a sala
                // "quente" ainda re-renderizava ~20 dyns via SVG decode
                // (dance: 9.3s -> 7.9s entre sessoes; agora cobre tudo)
                const cacheKey = `v3|${pack}|ss${this._ss.toFixed(2)}|${movie.fingerprint()}`;
                const cached = await idbGet(cacheKey);
                let cacheHit = false;
                if (this.movie !== movie) { releaseHold(); return; }
                const dynCount = this._dynList?.length || 0;
                if (cached?.layers?.length === this.movieLayers.length
                    && (cached?.dyns?.length || 0) === dynCount) {
                    cacheHit = true;
                    for (let i = 0; i < this.movieLayers.length; i++) {
                        const layer = this.movieLayers[i];
                        try {
                            const bmp = await createImageBitmap(cached.layers[i]);
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
                    releaseHold(); // sala pronta: decode de fundo pode voltar
                    if (this.movie !== movie) return;
                    for (const layer of this.movieLayers) layer.img.setVisible(true);
                    this._movieReady = true;
                    this.loadingScreen?.hide();
                    // sala pronta: libera o warm-up dos SVGs do pinguim/roupas
                    // (ficou na fila durante o load para nao competir)
                    PenguinLibrary.startWarm?.();
                    // prefetch idle dos packs das salas nao visitadas (IDB)
                    this._prefetchRoomsIdle();
                    // garante que o pinguim está em posição acessível
                    this._applySafeSpawn();
                };
                // Rasteriza as layers em LANES paralelas: o grosso do tempo
                // de _renderSegment e espera de decode/raster (artCanvas /
                // createImageBitmap), nao CPU — serializar os segmentos
                // deixava a main thread ociosa entre decodes. Cada segmento
                // desenha no proprio canvas (ops seguem seriais dentro dele),
                // entao 3 lanes so sobrepoem as esperas; o raster 2D em si
                // continua single-thread. Yields entre segmentos mantem a
                // UI responsiva e o progresso parcial visivel no loader.
                const boot = async () => {
                    // 3 lanes medido otimo: 5 lanes piorou dance cold
                    // (12.6s vs 8.5s) — mais _renderSegment em paralelo so
                    // engrossa a fila FIFO de decode SVG + raster
                    const LANES = 3;
                    let next = 0, done = 0;
                    const worker = async () => {
                        while (this.movie === movie) {
                            const layer = this.movieLayers[next++];
                            if (!layer) return;
                            if (layer._busy) { await new Promise((r) => setTimeout(r, 30)); continue; }
                            layer._busy = true;
                            try {
                                await this._renderSegment(layer);
                            } catch (e) {
                                console.warn('[seg] render', e);
                            } finally {
                                layer.tex?.refresh();
                                layer._busy = false;
                            }
                            done++;
                            report(done);
                            await new Promise((r) => setTimeout(r, 0));
                        }
                    };
                    await Promise.all(Array.from({ length: LANES }, worker));
                    if (this.movie !== movie) { releaseHold(); return; }
                    // overlays dinamicos: render inicial antes do reveal
                    await this._renderDynamics(movie);
                    // salva no cache para a proxima visita (so se nao houve hit)
                    if (!cacheHit && this.movie === movie) {
                        const layers = [];
                        for (const layer of this.movieLayers) {
                            layers.push(await canvasToBlob(layer.canvas));
                        }
                        const dyns = [];
                        for (const d of this._dynList || []) {
                            dyns.push(d.canvas ? await canvasToBlob(d.canvas) : null);
                        }
                        if (layers.every(Boolean)
                            && dyns.every((b, i) => b || !(this._dynList || [])[i]?.canvas)
                            && this.movie === movie) {
                            idbPut(cacheKey, { layers, dyns, ts: Date.now() });
                        }
                    }
                    reveal();
                };
                if (!cacheHit) boot().catch((e) => {
                    console.warn('[movie] boot', e);
                    releaseHold();
                });
                else (async () => {
                    try {
                        // cria os canvases/textures dos dyns SEM renderizar
                        // (paint:false) e blita os blobs do cache — os
                        // overlays dinamicos eram o residual do load quente
                        await this._renderDynamics(movie, { paint: false });
                        const dyns = this._dynList || [];
                        for (let i = 0; i < dyns.length; i++) {
                            const d = dyns[i];
                            if (!d.canvas || !cached.dyns[i]) continue;
                            try {
                                const bmp = await createImageBitmap(cached.dyns[i]);
                                d.canvas.getContext('2d').drawImage(bmp, 0, 0);
                                bmp.close();
                            } catch { /* blob ruim: dyn fica vazio ate dirty render */ }
                            d.tex?.refresh();
                        }
                    } finally { reveal(); }
                })();
                const frame = () => {
                    movie.tick();
                    const dyns = this._dynList || [];
                    const segs = this.movieLayers || [];
                    if (dyns.length || segs.length) {
                        const dp = movie._dirtyPaths || new Set();
                        const fp = movie._dirtyForcedPaths || new Set();
                        const dynHit = (p, d) => p === d.path
                            || p.startsWith(d.path + '.') || p.startsWith(d.path + '#')
                            || d.path.startsWith(p + '.') || d.path.startsWith(p + '#')
                            || d.path.endsWith('.' + p) || d.path.endsWith('#' + p)
                            || p.endsWith('.' + d.path) || p.endsWith('#' + d.path);
                        // overlays: playheads avancados (filhos '.'/'#' contam)
                        const dirtyDyns = new Set();
                        if (dp.size) {
                            for (const p of dp) for (const d of dyns) {
                                if (p === d.path || p.startsWith(d.path + '.') || p.startsWith(d.path + '#')) dirtyDyns.add(d);
                            }
                        }
                        // overlays por interacao (botao/texto/goto dentro do sprite)
                        if (fp.size) for (const p of fp) for (const d of dyns) if (dynHit(p, d)) dirtyDyns.add(d);
                        for (const d of dirtyDyns) {
                            if (d._busy || !d.canvas) continue;
                            d._busy = true;
                            movie.renderSpriteDynamic(d, this._ss)
                                .then(() => d.tex?.refresh())
                                .catch((e) => console.warn('[dyn] render', e))
                                .finally(() => { d._busy = false; });
                        }
                        // segmentos: dirty paths NAO cobertos por overlay
                        // (conteudo mascarado/congelado dentro de static ops)
                        // + interacoes dentro deles (botao/texto)
                        const dirtySegs = new Set();
                        if (dp.size) {
                            for (const p of dp) {
                                let covered = false;
                                for (const d of dyns) {
                                    if (p === d.path || p.startsWith(d.path + '.') || p.startsWith(d.path + '#')) { covered = true; break; }
                                }
                                if (covered) continue;
                                for (const seg of segs) if (seg.paths?.has(p)) { dirtySegs.add(seg); break; }
                            }
                        }
                        if (fp.size) {
                            for (const p of fp) {
                                for (const seg of segs) if (!dirtySegs.has(seg) && this._segRelated(seg, p)) dirtySegs.add(seg);
                            }
                        }
                        for (const seg of dirtySegs) {
                            if (seg._busy) continue;
                            seg._busy = true;
                            this._renderSegment(seg)
                                .then(() => seg.tex?.refresh())
                                .catch((e) => console.warn('[seg] render', e))
                                .finally(() => { seg._busy = false; });
                        }
                        return;
                    }
                    // fallback (sem segmentos/dynamics): comportamento antigo —
                    // re-render das layers com playhead ativo no frame
                    const targets = this.movieLayers.filter((l) => movie._dirtyRoots.has(l.rootKey));
                    if (targets.length === 0) return;
                    for (const layer of targets) {
                        if (layer._busy) continue; // renderLayer async nao pode sobrepor
                        layer._busy = true;
                        this._renderSegment(layer)
                            .catch((e) => console.warn('[seg] render', e))
                            .then(() => layer.tex?.refresh())
                            .finally(() => { layer._busy = false; });
                    }
                };
                this.movieTimer = this.time.addEvent({ delay: 1000 / movie.rate, loop: true, callback: frame });
            })
            .catch((e) => {
                releaseHold();
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

    // Segmenta cada top-level layer na ordem de desenho do Flash:
    // subarvores estaticas viram "segmentos" (canvas cropado proprio) e
    // sprites animados viram overlays — segmentos e overlays intercalam
    // por depth, restaurando o z-order original (estatico pode ficar
    // na frente de animado e vice-versa).
    async _setupDynamics(movie) {
        this._dynList = null;
        this._segments = null;
        const layers = movie.topLevelLayers();
        const collected = layers.map((l, i) => ({ l, i, items: movie.collectItems(l.entry) }));
        const totalDyns = collected.reduce((n, c) => n + c.items.filter((it) => it.type === 'dyn').length, 0);
        if (totalDyns > 60) {
            // sala com animacao demais: fallback — layer inteira estatica
            // (comportamento antigo, re-render por _dirtyRoots)
            const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
            this._segments = collected.map(({ l, i }) => ({
                ops: [{ type: 'static', entries: [l.entry], matrix: ID, path: '', color: IDENT_COLOR }],
                order: 0, depth: l.z + i * 0.001 + 0.0005,
                layerIdx: i, layerZ: l.z,
                rootKey: l.entry.name || `#${l.entry.depth}`,
                paths: new Set(), canvas: null, tex: null, img: null, texKey: null, _busy: false,
            }));
            for (const seg of this._segments) {
                movie.collectPaths(seg.ops[0].entries, '', seg.paths);
                seg.paths.add('');
            }
            movie._skipDynamic = null;
            return;
        }
        movie._skipDynamic = new Set();
        const dyns = [];
        const segs = [];
        for (const { l, i, items } of collected) {
            const base = l.z + i * 0.001;
            const step = 0.0009 / Math.max(1, items.length);
            const rootKey = l.entry.name || `#${l.entry.depth}`;
            let cur = null;
            const flush = () => {
                if (!cur) return;
                cur.depth = base + (cur.order + 1) * step;
                segs.push(cur);
                cur = null;
            };
            items.forEach((it, k) => {
                if (it.type === 'dyn') {
                    // overlay so se tiver bounds renderizavel — frames vazios
                    // ou maiores que o limite viram op estatico (fallback)
                    const db = movie.dynBounds(it.dyn, this._ss);
                    const okDyn = db && (db[2] - db[0] + 8) <= 4000 && (db[3] - db[1] + 8) <= 4000;
                    if (okDyn) {
                        flush();
                        it.dyn.layerZ = l.z; it.dyn.layerIdx = i;
                        it.dyn.order = k; it.dyn.depth = base + (k + 1) * step;
                        dyns.push(it.dyn);
                        movie._skipDynamic.add(it.dyn.path);
                        return;
                    }
                    it = { type: 'static', entries: [it.dyn.entry], matrix: it.dyn.parentMatrix, path: it.dyn.parentPath, color: it.dyn.parentColor };
                }
                if (!cur) cur = { ops: [], order: k, depth: 0, layerIdx: i, layerZ: l.z, rootKey, paths: new Set(), canvas: null, tex: null, img: null, texKey: null, _busy: false };
                cur.ops.push(it);
            });
            flush();
        }
        // paths de cada segmento (para dirty/forced -> re-render cirurgico)
        for (const seg of segs) {
            for (const op of seg.ops) {
                movie.collectPaths(op.entries, op.path, seg.paths);
                if (op.path) seg.paths.add(op.path);
            }
        }
        this._dynList = dyns;
        this._segments = segs;
    }

    _segRelated(seg, p) {
        for (const sp of seg.paths) {
            if (p === sp || p.startsWith(sp + '.') || p.startsWith(sp + '#')
                || sp.startsWith(p + '.') || sp.startsWith(p + '#')
                || sp.endsWith('.' + p) || sp.endsWith('#' + p)
                || p.endsWith('.' + sp) || p.endsWith('#' + sp)) return true;
        }
        return false;
    }

    // Re-renderiza um segmento estatico no seu canvas cropado.
    async _renderSegment(seg) {
        const movie = this.movie;
        if (!seg?.canvas || this.movie !== movie) return;
        const ctx = seg.canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, seg.canvas.width, seg.canvas.height);
        ctx.translate(-seg.ox, -seg.oy);
        const ss = this._ss;
        for (const op of seg.ops) {
            const m = op.matrix;
            const dev = { a: ss * m.a, b: ss * m.b, c: ss * m.c, d: ss * m.d, x: ss * m.x, y: ss * m.y };
            try {
                await movie._drawEntries(ctx, op.entries, dev, op.path, op.color, ss, 1);
            } catch (e) {
                console.warn('[seg] draw', op.path, e);
            }
        }
    }

    // Cria canvas/textura/imagem Phaser para cada overlay dinamico.
    // Bounds = uniao de todos os frames (device px) — cobre a animacao.
    // paint:false so cria a estrutura (cache hit blita o blob por cima).
    async _renderDynamics(movie, { paint = true } = {}) {
        const list = this._dynList;
        if (!list?.length || this.movie !== movie) return;
        // idempotente: re-render (ex.: troca de supersampling) recria tudo
        for (const d of list) {
            d.img?.destroy();
            if (d.texKey && this.textures.exists(d.texKey)) this.textures.remove(d.texKey);
            d.canvas = null; d.tex = null; d.img = null;
        }
        const ss = this._ss;
        const base = movie.base.split('/').pop();
        await Promise.all(list.map(async (d, j) => {
            const b = movie.dynBounds(d, ss);
            if (!b) return;
            const pad = 4;
            const x0 = Math.floor(b[0]) - pad, y0 = Math.floor(b[1]) - pad;
            const w = Math.ceil(b[2]) + pad - x0, h = Math.ceil(b[3]) + pad - y0;
            if (w <= 0 || h <= 0 || w > 4000 || h > 4000) return;
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const texKey = `dyn_${base}_${j}`;
            if (this.textures.exists(texKey)) this.textures.remove(texKey);
            const tex = this.textures.addCanvas(texKey, canvas);
            // position/displaySize em coords de mundo (canvas e device px)
            const img = this.add.image((x0 + w / 2) / ss, (y0 + h / 2) / ss, texKey)
                .setDisplaySize(w / ss, h / ss)
                .setDepth(d.depth);
            d.canvas = canvas; d.tex = tex; d.img = img; d.texKey = texKey;
            d.ox = x0; d.oy = y0;
            if (!paint) return;
            try {
                await movie.renderSpriteDynamic(d, ss);
            } catch (e) {
                console.warn('[dyn] render inicial', d.path, e);
            }
            tex.refresh();
        }));
    }

    _buildMovieLayers() {
        if (!this.movie || !this._segments) return;
        for (const seg of this.movieLayers || []) {
            seg.img?.destroy();
            if (seg.texKey && this.textures.exists(seg.texKey)) this.textures.remove(seg.texKey);
        }
        this.movieLayers = [];
        const ss = this._ss;
        const base = this.movie.base.split('/').pop();
        // um canvas cropado por segmento estatico — bounds = uniao dos ops
        // em device px (mesma convencao dos overlays dinamicos)
        for (const seg of this._segments) {
            let b = null;
            for (const op of seg.ops) {
                const m = op.matrix;
                const dev = { a: ss * m.a, b: ss * m.b, c: ss * m.c, d: ss * m.d, x: ss * m.x, y: ss * m.y };
                const ob = this.movie._boundsOfEntries(op.entries, dev, op.path);
                if (ob) b = b ? [Math.min(b[0], ob[0]), Math.min(b[1], ob[1]), Math.max(b[2], ob[2]), Math.max(b[3], ob[3])] : ob;
            }
            if (!b) continue; // segmento sem conteudo visivel
            const pad = 4;
            const x0 = Math.floor(b[0]) - pad, y0 = Math.floor(b[1]) - pad;
            const w = Math.ceil(b[2]) + pad - x0, h = Math.ceil(b[3]) + pad - y0;
            if (w <= 0 || h <= 0 || w > 8000 || h > 8000) continue;
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const texKey = `movie_seg_${base}_${this.movieLayers.length}`;
            if (this.textures.exists(texKey)) this.textures.remove(texKey);
            const tex = this.textures.addCanvas(texKey, canvas);
            const img = this.add.image((x0 + w / 2) / ss, (y0 + h / 2) / ss, texKey)
                .setDisplaySize(w / ss, h / ss)
                .setDepth(seg.depth)
                .setVisible(false); // so aparece quando a sala termina de carregar
            seg.canvas = canvas; seg.tex = tex; seg.img = img; seg.texKey = texKey;
            seg.ox = x0; seg.oy = y0;
            this.movieLayers.push(seg);
        }
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
        if (this._dynList) {
            for (const d of this._dynList) {
                d.img?.destroy();
                if (d.texKey && this.textures.exists(d.texKey)) this.textures.remove(d.texKey);
            }
            this._dynList = null;
        }
        this._segments = null;
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
