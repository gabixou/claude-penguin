// IglooManager — layout do iglu pessoal (Fase 3, issues #34-#38).
// Renderiza a "location" (interior tematico), o piso (flooring swatch) e a
// mobília posicionada pelo editor, tudo via MovieRoom (assets do wand).
// O estado vem do servidor (IGLOO_STATE); o dono edita via IglooEditor.

import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { SS_FIXED, WORLD_W, WORLD_H } from '../display.js';

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

    _syncEditBtn() {
        this._editBtn?.remove(); this._editBtn = null;
        if (this.isOwner && this.ownerId) {
            const b = document.createElement('button');
            b.textContent = 'Edit Igloo';
            b.style.cssText = 'position:fixed;bottom:70px;right:12px;z-index:55;padding:6px 12px;background:#0a3d6e;color:#fff;border:2px solid #7fd4ff;border-radius:6px;cursor:pointer;font:12px Verdana;';
            b.onclick = () => this.toggleEditor();
            document.body.appendChild(b);
            this._editBtn = b;
        }
    }

    leave() {
        this.scene?.events?.off?.('igloo-state', this._onState, this);
        this.scene?.events?.off?.('igloo-inventory', this._onInv, this);
        this.layout = null; this.ownerId = null; this.isOwner = false;
        this._clearFurniture();
        this._floorImg?.destroy(); this._floorImg = null;
        this._locImg?.destroy(); this._locImg = null;
        this.editor?.destroy(); this.editor = null;
        this._editBtn?.remove(); this._editBtn = null;
    }

    _onState = (data) => {
        if (!data || data.ownerId !== this.ownerId) return;
        this.layout = data;
        this.isOwner = this.ownerId === this.scene.network?.playerId;
        this._syncEditBtn();
        this._apply();
    };

    _onInv = (inv) => {
        this.inventory = (inv || []).map((r) => ({
            kind: r.kind, itemId: r.itemId ?? r.item_id, quantity: r.quantity,
        }));
        this.editor?._refreshPalette?.();
    };

    async _apply() {
        const l = this.layout;
        if (!l || this.scene.currentRoom !== 'igloo') return;
        await this._setupLocation(l.location || 1);
        await this._setupFloor(l.floor || 0);
        this._renderFurniture(l.items || []);
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

    // piso: flooring/N.swf — overlay sobre a location (tile do chao)
    async _setupFloor(floorId) {
        if (!floorId) { this._floorImg?.destroy(); this._floorImg = null; this._floorKey = 0; return; }
        const key = `igloo_floor_${floorId}`;
        if (this._floorKey === floorId && this._floorImg) return;
        // PISO: pendente — o SWF de flooring e full-stage e a mascara da
        // area do piso do iglu nao foi extraida ainda (precisa dos bounds
        // do iglooedit.swf). Ate la, floor>0 nao desenha overlay.
        // TODO(igloo-floor): recortar com a mascara real da area do piso.
        this._floorImg?.destroy(); this._floorImg = null; this._floorKey = floorId;
    }

    // mobília: sprites estaticos (frame 0 do pack furniture/<id>).
    // O stage do SWF e ~550x400 (preview de catalogo) — desenhamos no
    // tamanho nativo do stage e o Phaser escala p/ caber na cena.
    _furnitureTexture(itemId) {
        if (!this._furnTex.has(itemId)) {
            this._furnTex.set(itemId, (async () => {
                const pack = `/assets/movies/furniture/${itemId}`;
                const movie = await MovieRoom.load(pack).catch(() => null);
                if (!movie) return null;
                const sw = movie.stage?.width || 550, sh = movie.stage?.height || 400;
                const key = `furn_tex_${itemId}`;
                const t = await movieTexture(this.scene, pack, key, sw, sh).catch(() => null);
                if (!t) return null;
                // recorta a textura nos bounds da arte: o stage do SWF de
                // mobília é ~550x400 mas o item ocupa uma fração — sem o
                // crop o setDisplaySize encolhe o item a ~10px
                const clip = new Clip(movie);
                const frame = movie._mainTl?.frames?.[0] || [];
                const ID = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
                const b = clip._boundsOf?.(frame, ID, '') || null;
                if (!b) return { key, w: sw, h: sh };
                const ss = SS_FIXED, pad = 4;
                const x0 = Math.max(0, Math.floor((b[0] - pad) * ss));
                const y0 = Math.max(0, Math.floor((b[1] - pad) * ss));
                const x1 = Math.min(t.canvas.width, Math.ceil((b[2] + pad) * ss));
                const y1 = Math.min(t.canvas.height, Math.ceil((b[3] + pad) * ss));
                if (x1 - x0 < 8 || y1 - y0 < 8) return { key, w: sw, h: sh };
                const cv = document.createElement('canvas');
                cv.width = x1 - x0; cv.height = y1 - y0;
                cv.getContext('2d').drawImage(t.canvas, -x0, -y0);
                const key2 = `${key}_crop`;
                if (this.scene.textures.exists(key2)) this.scene.textures.remove(key2);
                this.scene.textures.addCanvas(key2, cv);
                return { key: key2, w: (b[2] - b[0] + pad * 2), h: (b[3] - b[1] + pad * 2) };
            })());
        }
        return this._furnTex.get(itemId);
    }

    _clearFurniture() {
        for (const img of this._furnSprites.values()) img.destroy();
        this._furnSprites.clear();
    }

    async _renderFurniture(items) {
        this._clearFurniture();
        const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
        for (const it of sorted) {
            const t = await this._furnitureTexture(it.itemId);
            if (!t || this.scene.currentRoom !== 'igloo') continue;
            const { x, y } = iglooCellToPx(it.x, it.y);
            // escala uniforme: maior lado ~96px (aproximacao ate termos
            // footprint real dos crumbs — ver visual-review)
            const s = 96 / Math.max(t.w, t.h);
            const img = this.scene.add.image(x, y, t.key)
                .setOrigin(0.5, 1)
                .setDisplaySize(t.w * s, t.h * s)
                .setDepth(800 + (y / WORLD_H) * 90);
            img._iglooItem = it;
            this._furnSprites.set(`${it.slot ?? it.itemId}-${it.x}-${it.y}`, img);
        }
    }

    // ---------- editor (dono) ----------

    toggleEditor() {
        if (!this.isOwner || this.scene.currentRoom !== 'igloo') return;
        if (this.editor?.isOpen) { this.editor.close(); return; }
        this.editor = new IglooEditor(this.scene, this);
        this.editor.open();
    }
}

// Editor de mobília: grade sobre o piso + palette DOM com catalogo.
// Place: seleciona item na palette -> clica na grade. Move: clica no item
// colocado -> clica no destino. Remove: seleciona item -> botao Remove.
// Piso/local/permissoes: controles no topo do painel.
class IglooEditor {
    constructor(scene, mgr) {
        this.scene = scene; this.mgr = mgr;
        this.isOpen = false;
        this.selected = null;   // {kind:'new',itemId} | {kind:'move',index}
        this.placement = [];    // itens em edicao (copia do layout)
        this._gfx = null;
        this._panel = null;
        this._inv = [];
        this._catalog = null;
        this._ghost = null;
    }

    async open() {
        this.isOpen = true;
        this.placement = (this.mgr.layout?.items || []).map((it, i) => ({ ...it, _i: i }));
        this._catalog = await iglooCatalog();
        this.scene.network?.sendIglooInventory?.();
        this._buildPanel();
        this._drawGrid();
        this._onMove = (p) => this._hover(p);
        this._onDown = (p) => this._click(p);
        this.scene.input.on('pointermove', this._onMove);
        this.scene.input.on('pointerdown', this._onDown);
        // bloqueia o clique de andar do RoomScene enquanto edita
        this.scene._iglooEditing = true;
    }

    close() {
        this.isOpen = false;
        this.scene.input.off('pointermove', this._onMove);
        this.scene.input.off('pointerdown', this._onDown);
        this.scene._iglooEditing = false;
        this._panel?.remove(); this._panel = null;
        this._gfx?.destroy(); this._gfx = null;
        this._ghost?.destroy(); this._ghost = null;
        this.mgr._renderFurniture(this.mgr.layout?.items || []);
    }

    destroy() { if (this.isOpen) this.close(); }

    _buildPanel() {
        const el = document.createElement('div');
        el.id = 'igloo-edit-panel';
        el.style.cssText = 'position:fixed;top:8px;right:8px;width:230px;max-height:86vh;overflow-y:auto;background:rgba(10,30,60,.94);border:2px solid #7fd4ff;border-radius:8px;padding:8px;color:#fff;font:12px Verdana,sans-serif;z-index:60;';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <b>Igloo Editor</b>
            <button data-a="close" style="cursor:pointer">✕</button></div>
          <div id="ig-cat" style="margin-bottom:6px"></div>
          <div id="ig-furn" style="margin-bottom:6px"></div>
          <div id="ig-sel" style="margin-bottom:6px;color:#ffd76a"></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button data-a="save" style="cursor:pointer">Salvar</button>
            <button data-a="remove" style="cursor:pointer">Remover</button>
            <button data-a="perms" style="cursor:pointer">Permissões</button>
          </div>`;
        el.querySelector('[data-a=close]').onclick = () => this.close();
        el.querySelector('[data-a=save]').onclick = () => this._save();
        el.querySelector('[data-a=remove]').onclick = () => this._removeSelected();
        el.querySelector('[data-a=perms]').onclick = () => this._perms();
        document.body.appendChild(el);
        this._panel = el;
        this._refreshPalette();
    }

    _refreshPalette() {
        if (!this._panel) return;
        const cat = this._catalog || {};
        const inv = this.mgr.inventory || [];
        const owned = new Set(inv.filter((i) => i.kind === 'furniture').map((i) => i.itemId));
        const furn = cat.furniture || {};
        const flr = cat.floorings || {};
        const loc = cat.locations || [];
        const names = (o, id) => o?.[String(id)]?.name || `#${id}`;
        const cost = (o, id) => o?.[String(id)]?.cost ?? 0;
        // seletor de piso
        const curFloor = this.mgr.layout?.floor || 0;
        const curLoc = this.mgr.layout?.location || 1;
        this._panel.querySelector('#ig-cat').innerHTML =
            `<div>Piso: <select data-k="floor">${Object.keys(flr).map((id) =>
                `<option value="${id}" ${Number(id) === curFloor ? 'selected' : ''}>${names(flr, id)} (${cost(flr, id)})</option>`).join('')}</select></div>
             <div>Local: <select data-k="location">${loc.map((l) =>
                `<option value="${l.igloo_location_id}" ${Number(l.igloo_location_id) === curLoc ? 'selected' : ''}>${l.name} (${l.cost})</option>`).join('')}</select></div>`;
        this._panel.querySelector('#ig-cat select').onchange = (e) => {
            const k = e.target.dataset.k;
            const v = Number(e.target.value);
            this.mgr.layout = { ...this.mgr.layout, [k === 'floor' ? 'floor' : 'location']: v };
            this.mgr._apply();
        };
        // lista de mobília possuída (placeable) + catálogo p/ compra
        const placeable = [...owned].slice(0, 200);
        this._panel.querySelector('#ig-furn').innerHTML =
            `<div style="max-height:40vh;overflow-y:auto">` +
            placeable.map((id) => `<div data-id="${id}" style="cursor:pointer;padding:2px;border-bottom:1px solid #234">${names(furn, id)}</div>`).join('') +
            `</div><div style="margin-top:4px;color:#9cf">Comprar:</div>` +
            Object.keys(furn).filter((id) => !owned.has(Number(id)) && cost(furn, id) > 0).slice(0, 120)
                .map((id) => `<div data-buy="${id}" style="cursor:pointer;padding:2px;border-bottom:1px solid #234;color:#fda">+ ${names(furn, id)} — ${cost(furn, id)}c</div>`).join('');
        this._panel.querySelectorAll('#ig-furn [data-id]').forEach((d) => {
            d.onclick = () => { this.selected = { kind: 'new', itemId: Number(d.dataset.id) }; this._markSel(); };
        });
        this._panel.querySelectorAll('#ig-furn [data-buy]').forEach((d) => {
            d.onclick = () => this._buy(Number(d.dataset.buy));
        });
    }

    async _buy(itemId) {
        this.scene.network?.sendIglooBuy('furniture', itemId);
        // inventario chega via igloo-inventory -> _refreshPalette
    }

    _markSel() {
        const el = this._panel?.querySelector('#ig-sel');
        if (el) el.textContent = this.selected
            ? (this.selected.kind === 'new' ? `Posicionar: item ${this.selected.itemId} — clique na grade` : `Mover item — clique no destino`)
            : '';
    }

    _drawGrid() {
        this._gfx?.destroy();
        this._gfx = this.scene.add.graphics().setDepth(700);
        const g = IGLOO_GRID;
        this._gfx.lineStyle(1, 0x7fd4ff, 0.25);
        for (let x = 0; x <= g.cols; x++) {
            this._gfx.lineBetween(g.x0 + x * g.cell, g.y0, g.x0 + x * g.cell, g.y0 + g.rows * g.cell);
        }
        for (let y = 0; y <= g.rows; y++) {
            this._gfx.lineBetween(g.x0, g.y0 + y * g.cell, g.x0 + g.cols * g.cell, g.y0 + y * g.cell);
        }
    }

    _cellAt(pointer) {
        const wx = pointer.worldX ?? pointer.x, wy = pointer.worldY ?? pointer.y;
        return iglooPxToCell(wx, wy);
    }

    _furnAtCell(cx, cy) {
        return this.placement.findIndex((it) => it.x === cx && it.y === cy);
    }

    _hover(pointer) {
        if (!this.isOpen || !this.selected) return;
        const c = this._cellAt(pointer);
        this._ghost?.destroy(); this._ghost = null;
        if (this.selected.kind === 'new') {
            const { x, y } = iglooCellToPx(c.x, c.y);
            this._ghost = this.scene.add.rectangle(x, y - 12, IGLOO_GRID.cell - 4, IGLOO_GRID.cell - 4, 0x7fd4ff, 0.3).setDepth(760);
        }
    }

    _click(pointer) {
        if (!this.isOpen) return;
        // nao editar clicando na palette DOM
        if (pointer.event?.target?.closest?.('#igloo-edit-panel')) return;
        const c = this._cellAt(pointer);
        const hit = this._furnAtCell(c.x, c.y);
        if (hit >= 0) {
            // clicou num item colocado: pega para mover (ou remove via botao)
            this._carried = this.placement.splice(hit, 1)[0];
            this.selected = { kind: 'move' };
            this._markSel();
            this.mgr._renderFurniture(this.placement.map((p, i) => ({ ...p, slot: i })));
            return;
        }
        if (this.selected?.kind === 'new') {
            this.placement.push({ itemId: this.selected.itemId, x: c.x, y: c.y, rotation: 0, frame: 0 });
            this.selected = null; this._markSel();
            this.mgr._renderFurniture(this.placement.map((p, i) => ({ ...p, slot: i })));
        } else if (this.selected?.kind === 'move' && this._carried) {
            this.placement.push({ ...this._carried, x: c.x, y: c.y });
            this._carried = null;
            this.selected = null; this._markSel();
            this.mgr._renderFurniture(this.placement.map((p, i) => ({ ...p, slot: i })));
        }
    }

    _removeSelected() {
        // remove o item carregado (ou cancela a selecao de item novo)
        this._carried = null;
        this.selected = null; this._markSel();
        this.mgr._renderFurniture(this.placement.map((p, i) => ({ ...p, slot: i })));
    }

    _perms() {
        const l = this.mgr.layout || {};
        const pw = prompt('Senha do igloo (vazio = sem senha):', l.hasPassword ? '••••' : '');
        if (pw === null) return;
        const friends = confirm('Somente amigos podem entrar?');
        this.scene.network?.sendIglooPerms({
            password: pw && pw !== '••••' ? pw : '',
            friendsOnly: friends,
        });
    }

    _save() {
        const items = this.placement.map((p, i) => ({
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
        this.close();
    }
}
