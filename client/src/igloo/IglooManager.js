// IglooManager — layout do iglu pessoal (Fase 3, issues #34-#38).
// Renderiza a "location" (interior tematico), o piso (flooring swatch) e a
// mobília posicionada pelo editor, tudo via MovieRoom (assets do wand).
// O estado vem do servidor (IGLOO_STATE); o dono edita via IglooEditor.

import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { SS_FIXED, WORLD_W, WORLD_H } from '../display.js';
import { as2Button, as2Sprite, iglooAs2Movie, movieFrameTexture } from './IglooWidgets.js';
import { IglooGridview } from './IglooGridview.js';
import { iglooHit, iglooAreaClipList } from './IglooAreas.js';
import { musicPlayer } from '../audio/MusicPlayer.js';
import MUSIC from '../audio/music.json';

// Grade do editor: regiao caminhavel do interior (cells de 24px).
// Calibrada contra o pack igloo-loc1 — refinar com visual-qa.
export const IGLOO_GRID = { x0: 70, y0: 185, cell: 24, cols: 27, rows: 11 };
export const iglooCellToPx = (cx, cy) => ({
    x: IGLOO_GRID.x0 + cx * IGLOO_GRID.cell + IGLOO_GRID.cell / 2,
    y: IGLOO_GRID.y0 + cy * IGLOO_GRID.cell + IGLOO_GRID.cell,
});
export const iglooPxToCell = (px, py) => ({
    x: Math.max(0, Math.min(IGLOO_GRID.cols - 1, Math.floor((px - IGLOO_GRID.x0) / IGLOO_GRID.cell))),
    y: Math.max(0, Math.min(IGLOO_GRID.rows - 1, Math.floor((py - IGLOO_GRID.y0) / IGLOO_GRID.cell))),
});

let _catalog = null;
export async function iglooCatalog() {
    if (!_catalog) {
        _catalog = await fetch('/assets/igloo-catalog.json')
            .then((r) => (r.ok ? r.json() : null)).catch(() => null) || {};
    }
    return _catalog;
}

// Desenha o frame 0 de um pack movie num canvas WSxHS e registra textura.
async function movieTexture(scene, packPath, texKey, w = WORLD_W, h = WORLD_H) {
    const movie = await MovieRoom.load(packPath).catch(() => null);
    if (!movie) return null;
    const clip = new Clip(movie);
    const frame = movie._mainTl?.frames?.[0] || [];
    const ss = SS_FIXED;
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * ss); cv.height = Math.round(h * ss);
    const ctx = cv.getContext('2d');
    ctx.scale(ss, ss);
    const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    const COL = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
    await clip._drawListFrame(ctx, frame, ID, '', COL, ss * 2);
    if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
    scene.textures.addCanvas(texKey, cv);
    return { movie, w, h, canvas: cv };
}

export class IglooManager {
    constructor(scene) {
        this.scene = scene;
        this.layout = null;          // ultimo IGLOO_STATE
        this.ownerId = null;         // playerId dono do iglu aberto
        this.isOwner = false;
        this._furnSprites = new Map(); // itemId -> Phaser.Image
        this._furnTex = new Map();     // itemId -> Promise<texKey|null>
        this._floorImg = null;
        this._locImg = null;
        this.editor = null;
    }

    // chamado quando a sala 'igloo' carrega — descobre o dono e pede layout
    enter(roomKey) {
        this.leave();
        // 'igloo' = proprio iglu (playerId pode ainda nao existir no boot);
        // 'igloo-<id>' = iglu de outro jogador
        const self = roomKey === 'igloo';
        const owner = self ? this.scene.network?.playerId : roomKey.slice(6);
        if (!self && !roomKey.startsWith('igloo-')) return;
        if (self && !owner) {
            // espera PLAYER_DATA para saber o proprio id
            this.scene.events.once('player-data', () => {
                if (this.scene.currentRoom === 'igloo') this.enter('igloo');
            });
            return;
        }
        this.ownerId = owner;
        this.isOwner = this.ownerId === this.scene.network?.playerId;
        this.scene.events.on('igloo-state', this._onState, this);
        this.scene.events.on('igloo-inventory', this._onInv, this);
        // boot direto em ?room=igloo: playerId ainda nao existe — espera o
        // PLAYER_DATA para pedir o layout (IGLOO_GET exige auth)
        const ask = () => {
            if (this.scene.network?.playerId) {
                this.isOwner = this.ownerId === this.scene.network.playerId;
                this.scene.network.sendIglooGet(this.ownerId);
                this.scene.network.sendIglooInventory?.();
            } else {
                this.scene.events.once('player-data', ask);
            }
        };
        ask();
    }

    // edit_tools_mc do igloo.swf AS2: so o dono ve lock_igloo_btn (131)
    // e edit_btn (122), nas posicoes reais do stage 760x480.
    async _syncRoomButtons() {
        this._roomBtns?.forEach((b) => b?.destroy?.());
        this._roomBtns = [];
        if (this.scene.currentRoom !== 'igloo' || !this.ownerId || !this.isOwner || this.editor?.isOpen) return;
        const scene = this.scene;
        // lock_igloo_btn (131): no SWF os 2 frames sao ESTADOS
        // (gotoAndStop(1)=locked, (2)=unlocked — setRoomStatus), nao
        // up/over — renderizamos manualmente e trocamos pelo layout.
        const lockTex = await this._lockTextures();
        if (lockTex) {
            const locked = !!(this.layout?.friendsOnly || this.layout?.hasPassword);
            const img = this.scene.add.image(712 + lockTex[locked ? 0 : 1].x0, 379 + lockTex[locked ? 0 : 1].y0, lockTex[locked ? 0 : 1].key)
                .setOrigin(0, 0).setScale(1 / SS_FIXED).setDepth(60);
            img.setInteractive({ useHandCursor: true });
            img.on('pointerup', () => this._lockToggle());
            img._lockTex = lockTex;
            this._roomBtns.push(img);
        }
        const edit = await as2Button(scene, '122', 711, 444, {
            key: 'ig2_edit', onClick: () => this.toggleEditor(),
        });
        if (edit) {
            edit.setData('isEditBtn', true);
            this._roomBtns.push(edit);
        }
    }

    // texturas dos 2 estados do lock_igloo_btn (sprite 131 do igloo-as2)
    async _lockTextures() {
        if (this._lockTex) return this._lockTex;
        const movie = await iglooAs2Movie();
        const sp = movie?.sprites?.['131'];
        if (!sp?.frames?.length) return null;
        const out = [];
        for (let i = 0; i < Math.min(2, sp.frames.length); i++) {
            const t = await movieFrameTexture(this.scene, movie, sp.frames[i], `ig2_lock_${i}`).catch(() => null);
            if (t) out.push(t); else out.push(null);
        }
        this._lockTex = out.some(Boolean) ? out : null;
        return this._lockTex;
    }

    // lockOnRelease do AS: igloo trancado -> prompt de confirmacao e
    // unlockIgloo; destrancado -> lockIgloo. No CP original "locked"
    // = somente amigos/buddies entram — mapeamos p/ friends_only
    // (mesma regra do checkAccess do servidor).
    _lockToggle() {
        const l = this.layout || {};
        const locked = !!(l.friendsOnly || l.hasPassword);
        if (locked) {
            if (!confirm('Deseja destrancar o igloo?')) return;
            this.scene.network?.sendIglooPerms({ friendsOnly: false, password: '' });
        } else {
            this.scene.network?.sendIglooPerms({ friendsOnly: true });
        }
    }

    _openCatalogue(sort) {
        this.scene.iglooCatalogue?.open?.(sort);
    }

    leave() {
        this.scene?.events?.off?.('igloo-state', this._onState, this);
        this.scene?.events?.off?.('igloo-inventory', this._onInv, this);
        this.layout = null; this.ownerId = null; this.isOwner = false;
        this._clearFurniture();
        this._floorImg?.destroy(); this._floorImg = null;
        this._locImg?.destroy(); this._locImg = null;
        this._roomBtns?.forEach((b) => b?.destroy?.()); this._roomBtns = null;
        this.iglooCatalogue?.destroy?.(); this.iglooCatalogue = null;
        this.editor?.destroy(); this.editor = null;
    }

    _onState = (data) => {
        if (!data || data.ownerId !== this.ownerId) return;
        this.layout = data;
        this.isOwner = this.ownerId === this.scene.network?.playerId;
        this._syncRoomButtons();
        this._apply();
    };

    _onInv = (inv) => {
        this.inventory = (inv || []).map((r) => ({
            kind: r.kind, itemId: r.itemId ?? r.item_id, quantity: r.quantity,
        }));
        this.editor?._refreshPalette?.();
    };

    // igloo_art<type>.swf e a propria sala no AS2 — o pack
    // igloo-type/<id> tem a mesma estrutura do pack 'igloo'. Quando o
    // layout chega (ou troca de tipo), sincroniza scene._iglooTypeId e,
    // se o movie ja carregou com outro tipo, recarrega a sala.
    _syncIglooTypeArt() {
        const sc = this.scene;
        if (sc.currentRoom !== 'igloo') return;
        const type = Number(this.layout?.iglooType) || 1;
        const want = type === 1 ? null : type; // 1 = pack base 'igloo'
        if (sc._iglooTypeId === want) return;
        sc._iglooTypeId = want;
        const loaded = sc.movie?.base;
        const expected = want ? `/assets/movies/igloo-type/${want}` : '/assets/movies/igloo';
        // movie ainda carregando: o _initMovie ja pegou o tipo novo
        if (!loaded || sc._movieReady === false) return;
        if (loaded === expected) return;
        sc._initMovie('igloo');
    }

    async _apply() {
        const l = this.layout;
        if (!l || this.scene.currentRoom !== 'igloo') return;
        this._syncIglooTypeArt();
        await this._setupLocation(l.location || 1);
        await this._setupFloor(l.floor || 0);
        this._renderFurniture(l.items || []);
        // updatePlayerRoomMusic do AS: música customizada do iglu
        if (l.music > 0) musicPlayer.playProgram(l.music);
    }

    // interior tematico: igloo-loc<N>.swf (locations/sprites do wand)
    async _setupLocation(locId) {
        const key = `igloo_loc_${locId}`;
        if (this._locKey === key && this._locImg) return;
        const pack = `/assets/movies/igloo-loc${locId || 1}`;
        const t = await movieTexture(this.scene, pack, key).catch(() => null);
        if (!t || this.scene.currentRoom !== 'igloo') return;
        this._locKey = key;
        this._locImg?.destroy();
        this._locImg = this.scene.add.image(WORLD_W / 2, WORLD_H / 2, key)
            .setDisplaySize(WORLD_W, WORLD_H).setDepth(0);
    }

    // piso: flooring/N.swf — textura full-stage recortada pela
    // room_area do igloo type (mesma area do checkArea). No AS2 o piso
    // cobre a area do chao; renderizamos frame 0 estatico acima do
    // background e abaixo da mobília (depth 8 < 12).
    async _setupFloor(floorId) {
        if (!floorId) { this._floorImg?.destroy(); this._floorImg = null; this._floorKey = 0; return; }
        const key = `igloo_floor_${floorId}`;
        if (this._floorKey === floorId && this._floorImg) return;
        this._floorKey = floorId;
        const movie = await MovieRoom.load(`/assets/movies/igloo-floor${floorId}`).catch(() => null);
        if (!movie || this.scene.currentRoom !== 'igloo') return;
        const clip = new Clip(movie);
        const frame = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
        const ss = this.scene._ss || SS_FIXED;
        // 1) rasteriza o frame do piso em canvas full-stage
        const src = document.createElement('canvas');
        src.width = Math.round(WORLD_W * ss); src.height = Math.round(WORLD_H * ss);
        const sctx = src.getContext('2d');
        sctx.scale(ss, ss);
        const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
        const COL = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };
        await clip._drawListFrame(sctx, frame, ID, '', COL, ss * 2);
        // 2) recorta pela room_area do tipo (Path2D unificado em pixels).
        // A room_area invade a base da parede (regiao de wall_area) —
        // no original a parede de gelo fica ACIMA do piso, entao
        // subtraimos wall_area da mascara (destination-out).
        const type = Number(this.layout?.iglooType) || 1;
        const roomAreas = await iglooAreaClipList(type, 'room');
        const wallAreas = await iglooAreaClipList(type, 'wall');
        const toMask = (areas) => {
            const mask = new Path2D();
            const scaleM = new DOMMatrix().scale(ss, ss);
            for (const a of areas) {
                mask.addPath(a.path, scaleM.multiply(new DOMMatrix(a.matrix)));
            }
            return mask;
        };
        const cv = document.createElement('canvas');
        cv.width = src.width; cv.height = src.height;
        const ctx = cv.getContext('2d');
        if (roomAreas.length) {
            ctx.save();
            ctx.clip(toMask(roomAreas), 'nonzero');
            ctx.drawImage(src, 0, 0);
            ctx.restore();
            if (wallAreas.length) {
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.clip(toMask(wallAreas), 'nonzero');
                ctx.fillRect(0, 0, cv.width, cv.height);
                ctx.restore();
            }
        } else {
            ctx.drawImage(src, 0, 0);
        }
        if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
        this.scene.textures.addCanvas(key, cv);
        this._floorImg?.destroy();
        this._floorImg = this.scene.add.image(WORLD_W / 2, WORLD_H / 2, key)
            .setDisplaySize(WORLD_W, WORLD_H).setDepth(8);
    }

    // mobília: sprites estaticos do pack furniture/<id>.
    // No AS2 o clip carregado e `item` (sprite com N frames = frame_1,
    // a "rotacao"/direcao) e dentro de cada frame ha `art` (sub-clip
    // com M frames = frame_2, o "estado" — ex.: lampada acesa/apagada).
    // obj.frame_1/obj.frame_2 do save sao 1-based; persistimos frame_1
    // em `rotation` e frame_2 em `frame` (colunas do servidor).
    // RenderEntries recorta nos bounds e devolve x0/y0 — a imagem vai
    // em (x+x0, y+y0) com escala 1/SS_FIXED = tamanho NATIVO do SWF.
    _frame1(it) {
        const r = Math.round(Number(it?.rotation) || 0);
        if (r >= 1) return r;
        // legado: rotation 0 -> wall items centravam em frame_1=2
        return Number(it?.type) === 2 ? 2 : 1;
    }
    _frame2(it) { return Math.max(1, Math.round(Number(it?.frame) || 0) || 1); }

    _furnitureTexture(itemId, f1 = 1, f2 = 1) {
        const ck = `${itemId}_${f1}_${f2}`;
        if (!this._furnTex.has(ck)) {
            this._furnTex.set(ck, (async () => {
                const pack = `/assets/movies/furniture/${itemId}`;
                const movie = await MovieRoom.load(pack).catch(() => null);
                if (!movie) return null;
                const clip = new Clip(movie);
                clip.goto('item', Math.max(1, f1 | 0), false);
                clip.goto('item.art', Math.max(1, f2 | 0), false);
                const frame = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
                const t = await movieFrameTexture(this.scene, movie, frame, `furn_tex_${ck}`, SS_FIXED, clip).catch(() => null);
                if (!t) return null;
                return { key: t.key, w: t.w, h: t.h, x0: t.x0, y0: t.y0 };
            })());
        }
        return this._furnTex.get(ck);
    }

    // total de frames de rotacao (item) e de estado (art do frame atual)
    async _furnFrameInfo(itemId, f1 = 1) {
        const movie = await MovieRoom.load(`/assets/movies/furniture/${itemId}`).catch(() => null);
        if (!movie) return null;
        const main = movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [];
        const itemE = main.find((e) => e.name === 'item') || main[0];
        const sp = movie.sprites?.[String(itemE?.id)];
        const f1Max = sp?.frames?.length || 1;
        const f1n = Math.min(Math.max(1, f1 | 0), f1Max);
        const frame = sp?.frames?.[f1n - 1] || [];
        const artE = frame.find((e) => e.name === 'art');
        const artSp = artE && movie.sprites?.[String(artE.id)];
        return { f1Max, f2Max: artSp?.frames?.length || 1 };
    }

    _clearFurniture() {
        for (const img of this._furnSprites.values()) img.destroy();
        this._furnSprites.clear();
    }

    // coords legadas em CELDAS (layout antigo 27x11) -> pixels do stage
    _itemPx(it) {
        if (it.x <= IGLOO_GRID.cols && it.y <= IGLOO_GRID.rows && it.x !== undefined) {
            const p = iglooCellToPx(it.x, it.y);
            return { x: p.x, y: p.y };
        }
        return { x: it.x, y: it.y };
    }

    async _renderFurniture(items, { lift = 0 } = {}) {
        this._clearFurniture();
        const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
        // updateObjectDepth do AS: depth = floor(x) + 1000*floor(y).
        // No SWF os itens vivem em containers separados — wall_mc(2) <
        // floor_mc(3) < room_mc(4): wall atras, depois floor (tapetes),
        // depois room (moveis) — replicado em tiers.
        // `lift` sobe a mobília acima do background_cover (40) no modo
        // edição; a faixa edit (41..53) fica abaixo dos controles (57+).
        const TIER = { 2: 0, 3: 1 }; // wall, floor(rugs); resto = room
        const tierOf = (it) => TIER[Number(it?.type)] ?? 2;
        const base = lift ? 41 : 12;
        // banda de 4 por tier (frac < 1) — containers do AS nunca se
        // sobrepoem: TODO wall < TODO floor < TODO room, cada um
        // internamente ordenado por floor(x)+1000*floor(y).
        // lift: mobília fica em 41..53 — abaixo do drag (54) e dos
        // controles (57+); sem lift: 12..24, abaixo dos pinguins (901+).
        const frac = (x, y) => (Math.floor(x) + 1000 * Math.floor(y))
            / (WORLD_W + 1000 * WORLD_H);
        const depthOf = (x, y, it) => base + tierOf(it) * 4 + frac(x, y);
        for (const it of sorted) {
            // type vem do catalogo quando o layout nao o traz (server
            // so persiste itemId/x/y/rotation/frame)
            if (it.type === undefined || it.type === null) {
                const cat = await iglooCatalog();
                it.type = Number(cat.furniture?.[String(it.itemId)]?.type || 1);
            }
            const t = await this._furnitureTexture(it.itemId, this._frame1(it), this._frame2(it));
            if (!t || this.scene.currentRoom !== 'igloo') continue;
            const { x, y } = this._itemPx(it);
            const img = this.scene.add.image(x + t.x0, y + t.y0, t.key)
                .setOrigin(0, 0)
                .setScale(1 / SS_FIXED)
                .setDepth(depthOf(x, y, it));
            img._iglooItem = it;
            img._iglooTexInfo = t;
            this._furnSprites.set(`${it.slot ?? it.itemId}-${it.x}-${it.y}`, img);
            this._furnCb?.(img); // editor: attach drag & drop
        }
    }

    // ---------- editor (dono) ----------

    toggleEditor() {
        if (!this.isOwner || this.scene.currentRoom !== 'igloo' || this.editor?.isOpen) return;
        this.editor = new IglooEditor(this.scene, this);
        this.editor.open();
    }
}

// Editor de iglu — port do fluxo do igloo.swf AS2 (frame_1 DoAction):
//   edit_btn -> startEditMode: esconde HUD/players, mostra
//   background_cover + edit_controls (view items / buy items /
//   upgrade igloo) + save_btn no lugar do edit_btn.
//   Mobília vira arrastavel (onMouseMove/onMouseUp): soltar fora da
//   area (ou na lixeira) remove; dentro, grava x/y e depth = x+1000y.
//   furniture_list_btn alterna o furniture_selector_mc com as abas
//   all/floor/room/wall/puffle/igloo -> startGridview (aqui: catalogo).
class IglooEditor {
    constructor(scene, mgr) {
        this.scene = scene; this.mgr = mgr;
        this.isOpen = false;
        this.placement = [];
        this._objs = [];       // imagens Phaser das mobílias em edição
        this._ctrls = [];      // botoes do edit_controls
        this._cover = null;
        this._selector = null;
        this._selectorZones = [];
        this._drag = null;
        this._hidden = [];     // objetos escondidos no enter (hud/players)
    }

    async open() {
        this.isOpen = true;
        // normaliza p/ pixels do stage (layouts antigos vieram em celulas)
        this.placement = (this.mgr.layout?.items || []).map((it) => {
            const p = this.mgr._itemPx(it);
            return { ...it, x: p.x, y: p.y };
        });
        this.scene.network?.sendIglooInventory?.();
        // ---- startEditMode (AS): hideInterface + cover + controls ----
        this._hiddenHud = this.scene.gpHud;
        this._hiddenHud?.setVisible?.(false);
        for (const p of this.scene.remotePlayers?.values?.() || []) this._hide(p);
        for (const p of this.scene.iglooPetViews?.values?.() || []) this._hide(p);
        if (this.scene.localPlayer) this._hide(this.scene.localPlayer);
        // botoes da sala saem de cena; save_btn assume o lugar do edit
        this.mgr._roomBtns?.forEach((b) => b.setVisible(false));
        // background_cover_mc esta em (0,0) no main timeline; a folha
        // (787x502) e MAIOR que o stage — sangra as bordas como no
        // original. O renderEntries adiciona 6px de padding transparente
        // a textura — compensamos com ~4% de escala extra p/ a arte
        // chegar nas bordas do stage.
        this._cover = (await as2Sprite(this.scene, '19', 0, 0, { key: 'ig2_cover', depth: 40 }))?.img;
        this._cover?.setOrigin(0.5).setPosition(WORLD_W / 2, WORLD_H / 2)
            .setScale(this._cover.scaleX * 1.04);
        // edit_controls (sprite 115): posicoes absolutas do stage —
        // music_btn (67) em (713,177), furniture_list_btn (64) em
        // (713,241), furniture_catalog_btn (84) em (713,311) e
        // igloo_upgrade_btn (86) em (713,382) — matrix dos filhos.
        const ctrls = [
            ['67', 713, 177, () => this._openMusic()],          // music_btn "Play Music"
            ['64', 713, 241, () => this._toggleSelector()],   // furniture_list_btn "View Items"
            // (guardado p/ hover-safe do selector — ver _selectorHover)
            // furniture_catalog_btn (84) = FurnDec2008.swf (loja de
            // mobílias); igloo_upgrade_btn (86) = IglooCatalogDec2008
            // (loja de pisos + tipos de iglu) — catalogs reais do CP.
            ['84', 713, 311, () => this.scene.catalogue?.open('furn2008')],
            ['86', 713, 382, () => this.scene.catalogue?.open('igloocat2008')],
        ];
        for (const [id, x, y, fn] of ctrls) {
            const b = await as2Button(this.scene, id, x, y, { onClick: fn, key: 'ig2_ctrl_' + id });
            if (b) {
                this._ctrls.push(b);
                if (id === '64') this._furnBoxBtn = b; // p/ hover-safe do selector
            }
        }
        // box_icon (sprite 64): icone da lixeira que persegue a mobília
        // enquanto ela esta sobre a trash_area (checkTrash do AS)
        this._trashIcon = (await as2Sprite(this.scene, '64', 0, 0, {
            key: 'ig2_trash', scale: 0.43, depth: 56,
        }))?.img;
        this._trashIcon?.setVisible(false);
        // save_btn (133) no lugar do edit_btn, com flipX como no SWF
        this._saveBtn = await as2Button(this.scene, '133', 711, 444, {
            key: 'ig2_save', flipX: true, onClick: () => this._save(),
        });
        // furniture_selector_mc (sprite 114) — popup de categorias.
        // No AS2 hit_area_mc (_alpha=0, 763x485 fullscreen) e
        // loading_mc (spinner) ficam ocultos — excluidos do render
        // para nao virarem overlay azul claro na tela.
        const sel = await as2Sprite(this.scene, '114', 580, 111, {
            key: 'ig2_furnsel', depth: 58,
            exclude: ['hit_area_mc', 'loading_mc'],
        });
        this._selector = sel?.img;
        this._selector?.setVisible(false);
        this._buildSelectorZones(sel?.tex);
        this.mgr._furnCb = (img) => this._attachDrag(img);
        this.mgr._renderFurniture(this.placement, { lift: 45 });
        this.scene._iglooEditing = true;
    }

    _hide(obj) {
        if (!obj) return;
        obj.setVisible?.(false);
        this._hidden.push(obj);
    }

    // abas do selector: all/floor/room/wall/puffle/igloo — no AS2 cada
    // uma chama startGridview com o filtro SHELL.FURNITURE_SORT_*
    // (exceto igloo, que lista igloos possuidos -> nosso catalogue).
    // O gridview mostra o INVENTARIO (show_count) — clique adiciona
    // a mobília no spawn padrao (floor_x/floor_y ou wall_x/wall_y).
    _buildSelectorZones(tex) {
        if (!this._selector || !tex) return;
        // sprite 114 (furniture_selector_mc) registro em (580,111);
        // buttons_mc (113) dentro em ~(7.45,0.45); abas a cada ~50px
        // comecando em y~0 — centros calculados dos matrices dos filhos.
        const SORT = [null, 3, 1, 2, 4, 'igloo']; // all,floor,room,wall,puffle,igloo
        // centros/rects medidos dos sprites reais (all_mc 111-173,
        // floor 180-224, room 230-274, wall 280-324, puffle 330-374,
        // igloo 380-424; x 587-674 com icones) — stage coords do
        // sprite 114@(580,111) -> buttons_mc@(7.45,0.45).
        const ys = [142, 202, 252, 302, 352, 402];
        SORT.forEach((sort, i) => {
            const z = this.scene.add.zone(630, ys[i], 106, 58)
                .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(59).setVisible(false);
            z.on('pointerup', () => { this._toggleSelector(false); this._openGridview(sort); });
            this._selectorZones.push(z);
        });
    }

    // startGridview do AS: lista = mobílias do inventário filtradas por
    // sort (catalog.sort: 1=room, 2=wall, 3=floor, 4=pet); count =
    // possuidas - ja colocadas; disabled se count<=0.
    // sortIgloo do AS: gridview so com os igloos POSSUIDOS
    // (getOwnedIgloos), count=1, disabled no tipo atual; clique ->
    // promptActivateIgloo -> activateIglooById: troca o tipo, APAGA
    // TODA a mobília (deleteAllFurniture), sai do modo edicao e salva.
    async _openGridview(sort) {
        if (sort === 'igloo') { await this._openIglooGrid(); return; }
        const cat = await iglooCatalog();
        const furn = cat.furniture || {};
        const placed = {};
        for (const it of this.placement) placed[it.itemId] = (placed[it.itemId] || 0) + 1;
        const invQty = {};
        for (const r of this.mgr.inventory || []) {
            if (r.kind === 'furniture') invQty[r.itemId] = (invQty[r.itemId] || 0) + (r.quantity || 1);
        }
        const items = [];
        for (const [id, e] of Object.entries(furn)) {
            const sid = Number(id);
            if (sort && Number(e.sort) !== sort) continue;
            const owned = invQty[sid] || 0;
            const avail = Math.max(0, owned - (placed[sid] || 0));
            items.push({ id: sid, name: e.name, count: avail, disabled: avail <= 0 });
        }
        items.sort((a, b) => a.id - b.id);
        this._gridview?.destroy();
        this._gridview = new IglooGridview(this.scene, {
            items,
            showCount: true,
            onPick: (id) => this._addFromGrid(id),
        });
        this._gridview.open();
    }

    // sortIgloo: lista = igloos possuidos (inventario kind 'igloo')
    // + o tipo atual; thumb = igloo-type/<id> (igloo_art do AS) com os
    // clips auxiliares escondidos (onIglooThumbLoaded).
    async _openIglooGrid() {
        const cat = await iglooCatalog();
        const ig = cat.igloos || {};
        const cur = this.mgr.layout?.iglooType ?? 1;
        const owned = new Set(
            (this.mgr.inventory || [])
                .filter((r) => r.kind === 'igloo' && (r.quantity || 1) > 0)
                .map((r) => r.itemId)
        );
        owned.add(cur); // o atual sempre aparece (AS: getOwnedIgloos inclui)
        const items = [...owned]
            .filter((id) => ig[String(id)] && id !== 0)
            .map((id) => ({
                id, name: ig[String(id)].name, count: 1,
                disabled: id === cur, igloo: true,
            }))
            .sort((a, b) => a.id - b.id);
        this._gridview?.destroy();
        const gv = new IglooGridview(this.scene, {
            items, showCount: false, perPage: 6,
            iconFor: (id) => this._iglooTypeIcon(id),
            onPick: (id) => this._activateIgloo(id),
        });
        this._gridview = gv;
        gv.open();
    }

    // thumb do igloo: pack igloo-type/<id> (o igloo_art/<type>.swf do
    // AS) — esconde room_area/wall_area/trash_area/block_mc/pet_area/
    // triggers_mc/waypointsClip como onIglooThumbLoaded.
    async _iglooTypeIcon(id) {
        const key = `igloo_type_icon_${id}`;
        if (this.scene.textures.exists(key)) return this.scene.textures.get(key);
        const movie = await MovieRoom.load(`/assets/movies/igloo-type/${id}`).catch(() => null);
        if (!movie) return null;
        const HIDE = new Set(['room_area', 'wall_area', 'trash_area', 'block_mc', 'pet_area', 'triggers_mc', 'waypointsClip']);
        const frame = (movie._mainTl?.frames?.[0] || movie.main?.frames?.[0] || [])
            .filter((en) => !HIDE.has(en.name));
        if (!frame.length) return null;
        const t = await movieFrameTexture(this.scene, movie, frame, key).catch(() => null);
        return t;
    }

    // promptActivateIgloo -> activateIglooById: aviso, troca tipo,
    // deleteAllFurniture, sai do modo edicao, sendActivateIgloo.
    _activateIgloo(id) {
        const cur = this.mgr.layout?.iglooType ?? 1;
        if (id === cur) return;
        if (!confirm('Ao trocar o tipo de iglu, todos os móveis serão removidos. Continuar?')) return;
        const l = this.mgr.layout || {};
        this.scene.network?.sendIglooSave({
            iglooType: id,
            location: l.location ?? 1,
            floor: 0, // activateIglooById: setCurrentIglooFloorId(0)
            music: l.music ?? 0,
            items: [], // deleteAllFurniture
        });
        this.close({ save: false }); // stopEditMode
    }

    // addFurnitureById do AS: spawn em floor_x/floor_y (room/floor) ou
    // wall_x/wall_y (wall) do igloo type; fallback centro do stage.
    async _addFromGrid(id) {
        const sp = await this._spawns();
        const cat = await iglooCatalog();
        const type = Number(cat.furniture?.[String(id)]?.type || 1);
        const isWall = type === 2;
        const x = isWall ? (sp.wall_x ?? 375) : (sp.floor_x ?? 380);
        const y = isWall ? (sp.wall_y ?? 160) : (sp.floor_y ?? 380);
        // addFurnitureHandleInit do AS: frame_1=1 (room/floor) ou 2
        // (wall, centrado); frame_2=1
        const it = {
            itemId: id, x: Math.floor(x), y: Math.floor(y), type,
            rotation: isWall ? 2 : 1, frame: 1,
        };
        this.placement.push(it);
        this.mgr._renderFurniture(this.placement, { lift: 45 });
    }

    async _spawns() {
        if (this._spawnData === undefined) {
            this._spawnData = await fetch('/assets/igloo-spawns.json')
                .then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
        }
        const type = this.mgr.layout?.iglooType ?? 1;
        return this._spawnData?.[String(type)] || {};
    }

    _iglooType() { return this.mgr.layout?.iglooType ?? 1; }

    // checkArea do AS: x 20..740 / y 20..460 E hitTest na area do tipo
    // (room/floor -> room_area ; wall -> wall_area). Sem dados do tipo,
    // fallback no retangulo 20..740/20..460.
    async _checkArea(x, y, it) {
        if (x <= 20 || x >= 740 || y <= 20 || y >= 460) return false;
        // obj.type do crumbs: 2 = wall (wall_area); demais = room_area
        let type = Number(it?.type);
        if (!type) {
            const cat = await iglooCatalog();
            type = Number(cat.furniture?.[String(it?.itemId)]?.type || 1);
        }
        const area = type === 2 ? 'wall' : 'room';
        const hit = await iglooHit(this._iglooType(), area, x, y);
        return hit === null ? true : hit;
    }

    // checkTrash do AS: fora de 20..740/20..460 OU dentro de trash_area
    async _checkTrash(x, y) {
        if (x < 20 || x > 740 || y < 20 || y > 460) return true;
        const hit = await iglooHit(this._iglooType(), 'trash', x, y);
        return hit === true;
    }

    // music_btn -> INTERFACE.showWindow("igloo_music"): o SWF original
    // lista as faixas do igloo; a lista vinha do webservice (indisponivel)
    // — usamos o music.json local (programIds reais dos assets).
    _openMusic() {
        this._musicWin?.remove();
        const cur = this.mgr.layout?.music ?? 0;
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:340px;max-height:380px;z-index:75;background:linear-gradient(180deg,#1c5fa8,#0a3d6e);border:3px solid #bfe6ff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.6);color:#fff;font:12px Verdana,sans-serif;display:flex;flex-direction:column;overflow:hidden';
        el.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:linear-gradient(180deg,#2e7fd4,#12509e);border-bottom:2px solid #bfe6ff">
            <b>Igloo Music</b>
            <button data-a="x" style="width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:#c33;color:#fff;cursor:pointer">✕</button>
          </div>
          <div data-r="list" style="flex:1;overflow-y:auto;padding:6px"></div>`;
        const list = el.querySelector('[data-r=list]');
        const pick = (id) => {
            const l = this.mgr.layout || {};
            this.scene.network?.sendIglooSave({
                iglooType: l.iglooType ?? 1, location: l.location ?? 1,
                floor: l.floor ?? 0, music: id,
                items: this.placement.map((p) => ({
                    itemId: p.itemId, x: p.x, y: p.y,
                    rotation: p.rotation || 0, frame: p.frame || 0,
                })),
            });
            if (id > 0) musicPlayer.playProgram(id); else musicPlayer.stop();
            this._musicWin?.remove(); this._musicWin = null;
        };
        const row = (id, label) => {
            const r = document.createElement('div');
            r.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px;border-bottom:1px solid #2a5a8a';
            r.innerHTML = `<span style="flex:1">${label}</span>`;
            const b = document.createElement('button');
            b.textContent = id === cur ? 'PLAYING' : 'PLAY';
            b.disabled = id === cur;
            b.style.cssText = 'padding:2px 10px;border-radius:4px;border:1px solid #bfe6ff;background:#12509e;color:#fff;cursor:pointer;font:bold 10px Verdana';
            b.onclick = () => pick(id);
            const prev = document.createElement('button');
            prev.textContent = '▶';
            prev.style.cssText = 'padding:2px 8px;border-radius:4px;border:1px solid #bfe6ff;background:#1e7a2e;color:#fff;cursor:pointer';
            prev.onclick = () => { if (id > 0) musicPlayer.playProgram(id); };
            r.append(prev, b);
            list.appendChild(r);
        };
        row(0, 'No Music');
        for (const id of Object.keys(MUSIC).slice(0, 60)) row(Number(id), `Track ${id}`);
        el.querySelector('[data-a=x]').onclick = () => { el.remove(); this._musicWin = null; };
        document.body.appendChild(el);
        this._musicWin = el;
    }

    _toggleSelector(force) {
        const show = force ?? !this._selector?.visible;
        this._selector?.setVisible(show);
        this._selectorZones.forEach((z) => z.setVisible(show));
        // hit_area_mc do AS2: rollOver em qualquer area fora do painel/
        // botoes fecha o selector. Phaser dispara eventos por objeto
        // (nao exclusivo), entao uma zone fullscreen fecharia ate sobre
        // os botoes — fazemos o hit-test no pointermove.
        if (show) {
            this._selHover = this._selHover || ((p) => this._selectorHover(p));
            this.scene.input.on('pointermove', this._selHover);
        } else if (this._selHover) {
            this.scene.input.off('pointermove', this._selHover);
        }
    }

    _selectorHover(p) {
        if (!this._selector?.visible) {
            this.scene.input.off('pointermove', this._selHover);
            return;
        }
        const x = p.worldX, y = p.worldY;
        // Filhos que bloqueiam o hit_area_mc no AS2: painel (sprite 92),
        // buttons_mc (sprite 113) e o proprio furniture_list_btn — o
        // mouse viaja do box ate os filtros cruzando uma faixa de ~25px
        // fora do painel; sem cobrir esse corredor o selector fechava
        // antes do clique chegar no botao.
        const img = this._selector;
        if (x >= img.x && x <= img.x + img.displayWidth &&
            y >= img.y && y <= img.y + img.displayHeight) return;
        const box = this._furnBoxBtn;
        if (box && x >= box.x && x <= box.x + box.displayWidth &&
            y >= box.y && y <= box.y + box.displayHeight) return;
        for (const z of this._selectorZones) {
            if (!z.visible) continue;
            // zona expandida p/ a direita: cobre icones dos botoes e o
            // corredor box->painel sem abrir areas fora da coluna
            if (x >= z.x - z.displayWidth / 2 && x <= z.x + z.displayWidth / 2 + 55 &&
                Math.abs(y - z.y) <= z.displayHeight / 2 + 6) return;
        }
        this._toggleSelector(false);
    }

    // editFurniture do AS: drag move o CLIP (registro = obj.x,obj.y);
    // a imagem fica em (x+x0, y+y0) — convertemos nos dois sentidos.
    _clipPos(img) {
        const t = img._iglooTexInfo || { x0: 0, y0: 0 };
        return { x: img.x - t.x0, y: img.y - t.y0 };
    }

    // Troca a textura do item para outro frame_1/frame_2 (rotação ou
    // estado) — equivalente ao item.gotoAndStop/frame do AS. Compensa
    // a mudanca de x0/y0 para a arte nao "pular".
    async _swapFrameTex(it, img) {
        const t = await this.mgr._furnitureTexture(it.itemId, this.mgr._frame1(it), this.mgr._frame2(it));
        if (!t || !img.scene) return;
        const old = img._iglooTexInfo || { x0: 0, y0: 0 };
        img.setTexture(t.key);
        img.x += (t.x0 - old.x0); img.y += (t.y0 - old.y0);
        img._iglooTexInfo = t;
    }

    // rotateFurniture/changeFurnitureState do AS: setas giram frame_1
    // (so nao-wall) e ciclam frame_2; Delete/Backspace apaga o item.
    async _dragKey(e) {
        const d = this._drag;
        if (!d) return;
        const code = e.code || e.key;
        const it = d.it;
        const isWall = Number(it.type) === 2;
        if (code === 'ArrowLeft' || code === 'ArrowRight') {
            if (isWall) return; // wall nao rotaciona por setas no AS
            const info = await this.mgr._furnFrameInfo(it.itemId, this.mgr._frame1(it));
            if (!info?.f1Max || info.f1Max <= 1) return;
            let n = this.mgr._frame1(it) + (code === 'ArrowLeft' ? 1 : -1);
            if (n > info.f1Max) n = 1; else if (n < 1) n = info.f1Max;
            it.rotation = n; // rotateFurniture mantem frame_2 (estado)
            await this._swapFrameTex(it, d.img);
        } else if (code === 'ArrowUp' || code === 'ArrowDown') {
            const info = await this.mgr._furnFrameInfo(it.itemId, this.mgr._frame1(it));
            if (!info?.f2Max || info.f2Max <= 1) return;
            let n = this.mgr._frame2(it) + (code === 'ArrowUp' ? 1 : -1);
            if (n > info.f2Max) n = 1; else if (n < 1) n = info.f2Max;
            it.frame = n;
            await this._swapFrameTex(it, d.img);
        } else if (code === 'Delete' || code === 'Backspace') {
            // deleteFurniture + finishEdit imediato
            this._dragUpNow();
        }
    }

    _dragUpNow() {
        const d = this._drag;
        if (!d) return;
        // simula soltar na lixeira: marca e finaliza
        d.trashed = true; d.moved = true;
        this._dragUp({ worldX: d.img.x, worldY: d.img.y });
    }

    _attachDrag(img) {
        img.setInteractive({ useHandCursor: true });
        img.on('pointerdown', (p) => {
            if (!this.isOpen) return;
            // catalogo aberto por cima do editor: cliques sao do catalogo
            if (this.scene.catalogue?.isOpen) return;
            const cp = this._clipPos(img);
            const px = p.worldX ?? p.x, py = p.worldY ?? p.y;
            this._drag = {
                img, it: img._iglooItem,
                // offset ponteiro->imagem (inclui x0/y0 do crop)
                dx: px - img.x, dy: py - img.y,
                startX: cp.x, startY: cp.y,
                moved: false, blocked: true, trashed: false,
                // hover_height do AS: so nao-wall levanta no drag
                lifted: Number(img._iglooItem?.type) !== 2,
            };
            img.setDepth(54); // topo entre a mobília (<=53) e controles (57+)
            if (this._drag.lifted) img.y -= 20;
            this.scene.input.on('pointermove', this._dragMove);
            this.scene.input.on('pointerup', this._dragUp);
            // key_listener do AS: ativo so durante o drag do item
            this._keyHandler = (e) => this._dragKey(e);
            this.scene.input.keyboard?.on('keydown', this._keyHandler);
        });
    }

    _dragMove = async (p) => {
        const d = this._drag;
        if (!d) return;
        const px = p.worldX ?? p.x, py = p.worldY ?? p.y;
        d.img.setPosition(px - d.dx, py - d.dy);
        d.moved = true;
        const cp = this._clipPos(d.img);
        d.blocked = await this._checkArea(cp.x, cp.y, d.it); // AS: is_blocked=checkArea (true=legal)
        d.trashed = await this._checkTrash(cp.x, cp.y);
        // AS: alpha=100 legal / 50 quando !is_blocked ou na lixeira
        d.img.setAlpha(d.blocked && !d.trashed ? 1 : 0.5);
        // rotateWallLeft/Center/Right do AS durante o drag (so wall)
        if (Number(d.it.type) === 2) {
            const sp = await this._spawns();
            const wl = sp.wall_left ?? 290, wr = sp.wall_right ?? 500;
            const want = cp.x < wl ? 1 : cp.x > wr ? 3 : 2;
            if (this.mgr._frame1(d.it) !== want) {
                d.it.rotation = want;
                await this._swapFrameTex(d.it, d.img);
            }
        }
        // BOX_ICON do AS persegue a mobília sobre a lixeira
        if (this._trashIcon) {
            const show = d.trashed;
            this._trashIcon.setVisible(show);
            if (show) {
                const b = d.img.getBounds();
                this._trashIcon.setPosition(b.centerX, d.img.y);
            }
        }
    };

    _dragUp = async (p) => {
        const d = this._drag;
        this._drag = null;
        this.scene.input.off('pointermove', this._dragMove);
        this.scene.input.off('pointerup', this._dragUp);
        if (this._keyHandler) {
            this.scene.input.keyboard?.off('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this._trashIcon?.setVisible(false);
        if (!d) return;
        if (d.lifted) d.img.y += 20; // hover_height
        const cp = this._clipPos(d.img);
        const idx = this.placement.indexOf(d.it);
        if (idx >= 0) {
            if (d.trashed) {
                this.placement.splice(idx, 1); // checkTrash -> deleteFurniture
            } else if (d.moved) {
                if (!d.blocked) {
                    // !is_blocked -> volta pro inicio (finishEdit revert)
                    d.it.x = d.startX; d.it.y = d.startY;
                } else {
                    d.it.x = Math.floor(cp.x); d.it.y = Math.floor(cp.y);
                }
            }
        }
        this.mgr._renderFurniture(this.placement, { lift: this.isOpen ? 45 : 0 });
    };

    close({ save = false } = {}) {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.scene._iglooEditing = false;
        this.mgr._furnCb = null;
        if (save) this._sendSave();
        // ---- stopEditMode (AS): devolve HUD/players/botoes ----
        this._hiddenHud?.setVisible?.(true);
        this._hidden.forEach((o) => o.setVisible?.(true));
        this._hidden = [];
        this._cover?.destroy(); this._cover = null;
        this._ctrls.forEach((b) => b.destroy()); this._ctrls = [];
        this._saveBtn?.destroy(); this._saveBtn = null;
        this._selector?.destroy(); this._selector = null;
        this._selectorZones.forEach((z) => z.destroy()); this._selectorZones = [];
        if (this._selHover) {
            this.scene.input.off('pointermove', this._selHover);
            this._selHover = null;
        }
        this._gridview?.destroy(); this._gridview = null;
        if (this._drag) {
            this.scene.input.off('pointermove', this._dragMove);
            this.scene.input.off('pointerup', this._dragUp);
            this._drag = null;
        }
        this._trashIcon?.destroy(); this._trashIcon = null;
        this._musicWin?.remove(); this._musicWin = null;
        if (this._keyHandler) {
            this.scene.input.keyboard?.off('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this.mgr._roomBtns?.forEach((b) => b.setVisible(true));
        if (this.scene.currentRoom === 'igloo') {
            this.mgr._syncRoomButtons();
            this.mgr._renderFurniture(this.mgr.layout?.items || []);
        }
    }

    destroy() { this.close(); }

    _sendSave() {
        const items = this.placement.map((p) => ({
            itemId: p.itemId, x: p.x, y: p.y,
            rotation: p.rotation || 0, frame: p.frame || 0,
        }));
        const l = this.mgr.layout || {};
        this.scene.network?.sendIglooSave({
            iglooType: l.iglooType ?? 1,
            location: l.location ?? 1,
            floor: l.floor ?? 0,
            music: l.music ?? 0,
            items,
        });
    }

    _save() {
        // no AS2: SAVE_BTN.onRelease = EDIT_BTN.onRelease -> toggleEditMode
        // -> stopEditMode -> saveRoom() (so salva se houve mudanca)
        this.close({ save: true });
    }
}
