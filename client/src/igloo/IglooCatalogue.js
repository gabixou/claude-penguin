// IglooCatalogue — janela do catalogo de mobília/pisos do iglu.
// O catalog_igloofurniture.swf do wand e so o shell (paginas vinham do
// webservice); aqui replicamos a janela original: moldura azul de
// catalogo, icones reais dos packs furniture/<id> e compra via
// IGLOO_BUY. Estilo visual segue o catalog_viewer do CP.

import { iglooCatalog } from './IglooManager.js';
import { MovieRoom } from '../movie/movie.js';

const WIN = { w: 560, h: 400 };

export class IglooCatalogue {
    constructor(scene) {
        this.scene = scene;
        this.isOpen = false;
        this.el = null;
        this.tab = 'furniture'; // furniture | flooring | location
        this._inv = new Set();
        this._itemsById = new Map();
    }

    open(sort) {
        if (this.isOpen) { this.sort = sort ?? this.sort; this._render(); return; }
        this.isOpen = true;
        this.sort = sort || null; // filtro do furniture_selector (sort do catalogo)
        this.tab = sort === 'igloo' ? 'igloo' : 'furniture';
        this.scene.network?.sendIglooInventory?.();
        this._build();
        this._render();
    }

    destroy() { this.close(); }

    close() {
        this.isOpen = false;
        this.el?.remove(); this.el = null;
    }

    setInventory(inv) {
        // guarda todos os kinds — a aba igloo (loja de tipos) precisa
        // saber quais igloos o jogador ja comprou
        this._invByKind = new Map();
        for (const i of inv || []) {
            const k = i.kind || 'furniture';
            if (!this._invByKind.has(k)) this._invByKind.set(k, new Set());
            // server manda item_id (snake); itemId e o alias do manager
            this._invByKind.get(k).add(i.itemId ?? i.item_id);
        }
        this._inv = this._invByKind.get('furniture') || new Set();
        // compra de piso/local: no CP original equipar e automatico —
        // quando o inventario confirma a posse, aplica na hora
        const pe = this._pendingEquip;
        if (pe && this._invByKind.get(pe.kind)?.has(pe.id)) {
            this._pendingEquip = null;
            if (pe.kind === 'flooring') this._equipFloor(pe.id);
            else if (pe.kind === 'location') this._equipLocation(pe.id);
        }
        if (this.isOpen) this._render();
    }

    _build() {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:${WIN.w}px;height:${WIN.h}px;z-index:70;background:linear-gradient(180deg,#1c5fa8 0%,#0a3d6e 8%,#0a3d6e 92%,#1c5fa8 100%);border:3px solid #bfe6ff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.6);display:flex;flex-direction:column;color:#fff;font:12px Verdana,sans-serif;overflow:hidden;`;
        el.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:linear-gradient(180deg,#2e7fd4,#12509e);border-bottom:2px solid #bfe6ff">
            <b style="font-size:14px;text-shadow:1px 1px 0 #063">Igloo Catalogue</b>
            <button data-a="close" style="width:20px;height:20px;border-radius:50%;border:2px solid #fff;background:#c33;color:#fff;font:bold 12px Verdana;cursor:pointer;line-height:1">✕</button>
          </div>
          <div style="display:flex;gap:4px;padding:6px 10px 0">
            ${['furniture', 'flooring', 'location', 'igloo'].map((t) =>
                `<button data-t="${t}" style="flex:1;padding:4px 0;border:1px solid #7fd4ff;border-radius:6px 6px 0 0;cursor:pointer;font:bold 11px Verdana;background:#0d4d8f;color:#cfe9ff">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
          </div>
          <div data-r="list" style="flex:1;overflow-y:auto;margin:4px 10px 10px;background:rgba(255,255,255,.08);border:1px solid #7fd4ff;border-radius:6px;padding:6px"></div>
          <div style="padding:4px 12px 8px;display:flex;justify-content:space-between;align-items:center">
            <span data-r="coins" style="color:#ffe27a;font-weight:bold"></span>
            <span style="color:#9fc7ee">Coins: buy with coins</span>
          </div>`;
        el.querySelector('[data-a=close]').onclick = () => this.close();
        el.querySelectorAll('[data-t]').forEach((b) => {
            b.onclick = () => { this.tab = b.dataset.t; this._render(); };
        });
        document.body.appendChild(el);
        this.el = el;
    }

    async _render() {
        const list = this.el?.querySelector('[data-r=list]');
        if (!list) return;
        const cat = await iglooCatalog();
        const coinsEl = this.el.querySelector('[data-r=coins]');
        if (coinsEl) coinsEl.textContent = `YOUR COINS: ${this.scene.network?.coins ?? 0}`;
        list.innerHTML = '<div style="color:#9fc7ee;padding:8px">Loading…</div>';
        if (this.tab === 'furniture') this._renderFurniture(list, cat);
        else if (this.tab === 'flooring') this._renderFlooring(list, cat);
        else if (this.tab === 'igloo') this._renderIgloos(list, cat);
        else this._renderLocations(list, cat);
    }

    async _icon(itemId) {
        // icone = crop do frame 0 do pack furniture/<id> (mesma textura do editor)
        const key = `igcat_icon_${itemId}`;
        if (this.scene.textures.exists(key)) return key;
        const mgr = this.scene.igloo;
        const t = await mgr?._furnitureTexture?.(itemId);
        return t?.key || null;
    }

    async _renderFurniture(list, cat) {
        const furn = cat.furniture || {};
        const owned = this._inv;
        let entries = Object.entries(furn)
            .map(([id, f]) => ({ id: Number(id), ...f }))
            .sort((a, b) => a.name.localeCompare(b.name));
        // filtro do selector do editor (abas all/floor/room/wall/puffle)
        if (this.sort && this.sort !== 'igloo')
            entries = entries.filter((f) => f.sort === this.sort);
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px';
        list.replaceChildren(grid);
        for (const f of entries) {
            const card = document.createElement('div');
            card.style.cssText = 'background:rgba(255,255,255,.1);border:1px solid #4a86c8;border-radius:6px;padding:6px;text-align:center;position:relative';
            const icon = document.createElement('div');
            icon.style.cssText = 'height:56px;display:flex;align-items:center;justify-content:center';
            const texKey = await this._icon(f.id);
            if (texKey) {
                const img = document.createElement('img');
                img.src = this.scene.textures.get(texKey).getSourceImage().toDataURL();
                img.style.cssText = 'max-width:52px;max-height:52px';
                icon.appendChild(img);
            }
            const name = document.createElement('div');
            name.style.cssText = 'font-size:10px;color:#fff;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            name.textContent = f.name;
            const buy = document.createElement('button');
            const has = owned.has(f.id);
            buy.textContent = has ? 'OWNED' : `${f.cost ?? 0}c`;
            buy.disabled = has;
            buy.style.cssText = `width:100%;margin-top:4px;padding:3px;border-radius:4px;border:1px solid #bfe6ff;cursor:${has ? 'default' : 'pointer'};font:bold 10px Verdana;background:${has ? '#3a5a7a' : 'linear-gradient(180deg,#3fae49,#1e7a2e)'};color:#fff`;
            if (!has) buy.onclick = () => this._buy('furniture', f.id, f.name, f.cost ?? 0);
            card.append(icon, name, buy);
            grid.appendChild(card);
        }
    }

    _renderFlooring(list, cat) {
        const fl = cat.floorings || {};
        const cur = this.scene.igloo?.layout?.floor || 0;
        const owned = this._invByKind?.get('flooring') || new Set();
        list.innerHTML = '';
        for (const [id, f] of Object.entries(fl)) {
            const iid = Number(id);
            // piso 0 = remocao/default: sempre equipavel de graca (o server
            // tambem libera floor<=0). Demais: so equipa se comprado —
            // antes mostrava EQUIP p/ tudo e o save era rejeitado.
            const free = iid <= 0 || !f.cost;
            const has = free || owned.has(iid);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #2a5a8a';
            row.innerHTML = `<span style="flex:1">${f.name} — ${f.cost ?? 0}c</span>`;
            const b = document.createElement('button');
            if (iid === cur) { b.textContent = 'EQUIPPED'; b.disabled = true; }
            else if (has) { b.textContent = 'EQUIP'; b.onclick = () => this._equipFloor(iid); }
            else { b.textContent = `${f.cost ?? 0}c`; b.onclick = () => this._buy('flooring', iid, f.name, f.cost ?? 0); }
            b.style.cssText = `padding:3px 10px;border-radius:4px;border:1px solid #bfe6ff;background:${b.disabled ? '#3a5a7a' : has ? '#12509e' : '#1e7a2e'};color:#fff;cursor:${b.disabled ? 'default' : 'pointer'};font:bold 10px Verdana`;
            row.appendChild(b);
            list.appendChild(row);
        }
    }

    _renderLocations(list, cat) {
        const locs = cat.locations || [];
        const cur = this.scene.igloo?.layout?.location || 1;
        const owned = this._invByKind?.get('location') || new Set();
        list.innerHTML = '';
        for (const l of locs) {
            const iid = Number(l.igloo_location_id);
            const free = !l.cost; // Default (cost 0) sempre equipavel
            const has = free || owned.has(iid);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #2a5a8a';
            row.innerHTML = `<span style="flex:1">${l.name} — ${l.cost ?? 0}c</span>`;
            const b = document.createElement('button');
            if (iid === cur) { b.textContent = 'EQUIPPED'; b.disabled = true; }
            else if (has) { b.textContent = 'EQUIP'; b.onclick = () => this._equipLocation(iid); }
            else { b.textContent = `${l.cost ?? 0}c`; b.onclick = () => this._buy('location', iid, l.name, l.cost ?? 0); }
            b.style.cssText = `padding:3px 10px;border-radius:4px;border:1px solid #bfe6ff;background:${b.disabled ? '#3a5a7a' : has ? '#12509e' : '#1e7a2e'};color:#fff;cursor:${b.disabled ? 'default' : 'pointer'};font:bold 10px Verdana`;
            row.appendChild(b);
            list.appendChild(row);
        }
    }

    // igloo_catalogue do AS = LOJA de tipos de iglu (igloo_upgrade_btn):
    // lista todos, comprados aparecem OWNED, atual EQUIPPED. Trocar o
    // tipo se faz na aba igloo do selector (gridview -> activateIgloo).
    _renderIgloos(list, cat) {
        const ig = cat.igloos || {};
        const cur = this.scene.igloo?.layout?.iglooType ?? 1;
        const owned = this._invByKind?.get('igloo') || new Set();
        list.innerHTML = '';
        for (const [id, g] of Object.entries(ig)) {
            if (id === '0') continue; // Igloo Removal
            const iid = Number(id);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #2a5a8a';
            row.innerHTML = `<span style="flex:1">${g.name}</span>`;
            const b = document.createElement('button');
            if (iid === cur) { b.textContent = 'EQUIPPED'; b.disabled = true; }
            else if (owned.has(iid)) { b.textContent = 'OWNED'; b.disabled = true; }
            else {
                b.textContent = `${g.cost ?? 0}c`;
                b.onclick = () => this._buy('igloo', iid, g.name, g.cost ?? 0);
            }
            b.style.cssText = `padding:3px 10px;border-radius:4px;border:1px solid #bfe6ff;background:${b.disabled ? '#3a5a7a' : '#1e7a2e'};color:#fff;cursor:${b.disabled ? 'default' : 'pointer'};font:bold 10px Verdana`;
            row.appendChild(b);
            list.appendChild(row);
        }
    }

    // equip de piso/local persiste via IGLOO_SAVE (antes so atualizava
    // local e perdia no reload)
    _saveLayout(patch) {
        const l = this.scene.igloo?.layout || {};
        this.scene.network?.sendIglooSave({
            iglooType: l.iglooType ?? 1,
            location: l.location ?? 1,
            floor: l.floor ?? 0,
            music: l.music ?? 0,
            items: (l.items || []).map((p) => ({
                itemId: p.itemId, x: p.x, y: p.y,
                rotation: p.rotation || 0, frame: p.frame || 0,
            })),
            ...patch,
        });
    }

    _equipFloor(id) {
        this._saveLayout({ floor: id });
        this._render();
    }

    _equipLocation(id) {
        this._saveLayout({ location: id });
        this._render();
    }

    _buy(kind, id, name, cost) {
        // piso/local: marca p/ auto-equip quando o inventario confirmar
        if (kind === 'flooring' || kind === 'location') this._pendingEquip = { kind, id };
        this.scene.network?.sendIglooBuy(kind, id);
        // inventario chega via igloo-inventory -> setInventory
    }
}
