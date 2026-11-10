// Wardrobe.js — painel de inventário lateral (estilo Club Penguin original).
// Abre ao lado do PlayerCard (que permanece visível à esquerda).
// Painel branco com grid 3x4 de itens, paginação e busca.
import Phaser from 'phaser';
import { WORLD_W, WORLD_H } from '../display.js';
import { assetMovie } from './paperDoll.js';
import { wardrobeItems, SLOT_LABELS } from '../items/catalog.js';
import { PENGUIN_COLORS, getColorInfo, colorItemToRgb } from '../items/colors.js';

const DEPTH = 20000000;
// Painel lateral acoplado ao PlayerCard (azul), como o inventario original:
// grade de icones (sem nomes), pill "All Items" no rodape e scroll circular.
// Largura ajustada ao conteudo (grid 3x54 + gaps + scrollbar) — antes sobrava
// uma faixa vazia grande a direita da grade.
const PANEL_W = 212, PANEL_H = 288;
const CELL_SIZE = 54;
const COLS = 3, ROWS = 4; // 12 itens por pagina
const GRID_GAP = 4;

export default class Wardrobe {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.dim = null;
        this.penguin = null;
        this.tab = 'all';
        this.items = [];
        this.cells = [];
        this.page = 0;
        this.search = '';
        this._iconTex = new Map();

        // Reage a PLAYER_DATA (compra/rename atualizam coins+inventario no
        // NetworkClient antes do emit) e a erros de rede enquanto aberto
        scene.events.on('player-data', () => this._onPlayerData());
    }

    get isOpen() { return !!this.container; }

    async open(penguin) {
        if (this.isOpen) this.close();
        this.penguin = penguin || this.scene.localPlayer;
        if (!this.penguin) return;
        this.items = await wardrobeItems();
        if (!this.scene.sys.isActive()) return;
        
        // Busca inventário do jogador
        const inventory = this.scene.network?.inventory || [];
        this.ownedIds = new Set(inventory.map(i => i.itemId));
        this.coins = this.scene.network?.coins || 0;
        
        this.page = 0;
        this.search = '';
        this._build();
        this._renderGrid();
    }

    close() {
        if (this.scene?.time) this.scene._wardrobeClosedAt = this.scene.time.now;
        this.dim?.destroy();
        this.container?.destroy(true);
        this.container = null;
        this.dim = null;
        this.cells = [];
        this.onClose?.();
        for (const k of this._iconTex.keys()) {
            if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
        }
        this._iconTex.clear();
    }

    _build() {
        const scene = this.scene;
        // posiciona à direita do player card (que está centralizado)
        let cardRight = WORLD_W / 2 + 120;
        const cb = scene.playerCard?._cardBounds;
        if (cb) cardRight = cb.right + 8;
        else if (scene.playerCard?.container) {
            const gb = scene.playerCard.container.getBounds();
            cardRight = gb.right + 8;
        }
        const px = Math.min(cardRight, WORLD_W - PANEL_W - 5);
        const py = WORLD_H / 2 - PANEL_H / 2;

        const cont = scene.add.container(0, 0).setDepth(DEPTH);
        this.container = cont;

        // ---- Painel branco ----
        const panelBg = scene.add.graphics();
        panelBg.fillStyle(0xf8f8f8, 1);
        panelBg.fillRoundedRect(px, py, PANEL_W, PANEL_H, 10);
        panelBg.lineStyle(2, 0x0072ce, 0.7);
        panelBg.strokeRoundedRect(px, py, PANEL_W, PANEL_H, 10);
        cont.add(panelBg);

        // zona invisivel cobrindo o painel inteiro: cliques em areas mortas
        // (fundo, gaps entre celulas, espaco vazio) nao atravessam para o
        // dim do player card — que fecharia card+inventario juntos.
        // Adicionada cedo no container: celulas/pill desenhadas depois ficam
        // acima na ordem de input (topOnly).
        const block = scene.add.zone(px + PANEL_W / 2, py + PANEL_H / 2, PANEL_W, PANEL_H)
            .setInteractive({ useHandCursor: false });
        cont.add(block);

        // (topo do painel limpo, como no original — sem contador)

        // categorias — no original a selecao e uma pilula "All Items"
        // no rodape que abre um menu; nao ha abas de texto no topo.
        this.cats = ['all', 'head', 'face', 'neck', 'body', 'hand', 'feet', 'flag', 'photo', 'color'];
        this.tabZones = [];
        this._catLabel = { all: 'All Items', color: 'Color' };
        const catName = (t) => this._catLabel[t] || SLOT_LABELS[t];

        // pilula inferior "All Items" — no original ela fica na borda
        // inferior do painel, projetando-se para fora (metade dentro/fora)
        const pillW = 100, pillH = 18;
        const pillX = px + PANEL_W / 2 - pillW / 2;
        const pillY = py + PANEL_H - 4;
        this._pillBg = scene.add.graphics();
        this._pillBg.fillStyle(0xeef4fa, 1);
        this._pillBg.fillRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
        this._pillBg.lineStyle(1.5, 0x0072ce, 0.6);
        this._pillBg.strokeRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
        cont.add(this._pillBg);
        this._pillText = scene.add.text(px + PANEL_W / 2, pillY + pillH / 2, '', {
            fontFamily: 'GoPenguin, Arial, sans-serif', fontSize: '9px',
            fontStyle: 'bold', color: '#333333', align: 'center',
        }).setOrigin(0.5);
        cont.add(this._pillText);
        const pillZone = scene.add.zone(px + PANEL_W / 2, pillY + pillH / 2, pillW, pillH)
            .setInteractive({ useHandCursor: true });
        pillZone.on('pointerdown', () => this._toggleCatMenu());
        cont.add(pillZone);
        this._pillRect = { x: pillX, y: pillY, w: pillW, h: pillH };
        this._catName = catName;
        this._updatePill();

        // menu de categorias (escondido ate clicar na pilula).
        // depth alto: o menu abre SOBRE o grid — sem isso as celulas
        // (criadas depois, no _gridCont) ficavam por cima e o clique
        // equipava o item em vez de escolher a categoria.
        this._catMenu = scene.add.container(0, 0).setVisible(false).setDepth(5);
        cont.add(this._catMenu);
        const menuW = 110, menuH = this.cats.length * 18 + 6;
        const menuX = px + PANEL_W / 2 - menuW / 2;
        const menuY = pillY - menuH - 4;
        const menuBg = scene.add.graphics();
        menuBg.fillStyle(0xffffff, 1);
        menuBg.fillRoundedRect(menuX, menuY, menuW, menuH, 6);
        menuBg.lineStyle(1.5, 0x0072ce, 0.6);
        menuBg.strokeRoundedRect(menuX, menuY, menuW, menuH, 6);
        this._catMenu.add(menuBg);
        this.cats.forEach((t, i) => {
            const my = menuY + 6 + i * 18 + 9;
            const mz = scene.add.zone(menuX + menuW / 2, my, menuW - 8, 16)
                .setInteractive({ useHandCursor: true });
            mz.on('pointerdown', () => { this.tab = t; this.page = 0; this._updatePill(); this._catMenu.setVisible(false); this._renderGrid(); });
            const mt = scene.add.text(menuX + menuW / 2, my, catName(t), {
                fontFamily: 'GoPenguin, Arial, sans-serif', fontSize: '9px',
                color: t === this.tab ? '#0072ce' : '#333333', fontStyle: 'bold',
            }).setOrigin(0.5);
            this._catMenu.add([mz, mt]);
            mz._mt = mt;
            mz._cat = t;
        });

        // grid de itens
        this._gridCont = scene.add.container(0, 0);
        cont.add(this._gridCont);
        this._gridX = px + 8;
        this._gridY = py + 36;

        // scrollbar vertical — calha cinza com botoes circulares metalicos
        const scrollX = px + PANEL_W - 16;
        const scrollY = py + 44;
        const scrollH = PANEL_H - 100;
        const track = scene.add.graphics();
        track.fillStyle(0xd8d8d8, 1);
        track.fillRoundedRect(scrollX - 6, scrollY, 12, scrollH, 6);
        track.lineStyle(1, 0xb0b0b0, 1);
        track.strokeRoundedRect(scrollX - 6, scrollY, 12, scrollH, 6);
        cont.add(track);
        const mkScrollBtn = (y, dir) => {
            const z = scene.add.zone(scrollX, y, 18, 18)
                .setInteractive({ useHandCursor: true });
            z.on('pointerdown', dir > 0 ? () => this._nextPage() : () => this._prevPage());
            const g = scene.add.graphics();
            g.fillStyle(0xf2f2f2, 1);
            g.fillCircle(0, 0, 8);
            g.lineStyle(1.5, 0x8a8a8a, 1);
            g.strokeCircle(0, 0, 8);
            g.lineStyle(1, 0xbdbdbd, 1);
            g.strokeCircle(0, 0, 5.5);
            g.lineStyle(1.5, 0x555555, 1);
            if (dir > 0) {
                g.lineBetween(-3, -1, 0, 2);
                g.lineBetween(0, 2, 3, -1);
            } else {
                g.lineBetween(-3, 1, 0, -2);
                g.lineBetween(0, -2, 3, 1);
            }
            g.setPosition(scrollX, y);
            cont.add([z, g]);
        };
        mkScrollBtn(scrollY + 12, -1);
        mkScrollBtn(scrollY + scrollH - 12, 1);

        // aba azul lateral direita (recolhe o painel, como no original)
        const tabX = px + PANEL_W - 2;
        const tabY = py + PANEL_H / 2 - 22;
        const sideTab = scene.add.graphics();
        sideTab.fillStyle(0x0072ce, 1);
        sideTab.fillRoundedRect(tabX - 4, tabY, 8, 44, 4);
        sideTab.fillStyle(0xffffff, 1);
        sideTab.fillTriangle(tabX - 1, tabY + 16, tabX - 1, tabY + 28, tabX + 4, tabY + 22);
        cont.add(sideTab);
        const sideZone = scene.add.zone(tabX + 1, tabY + 22, 14, 44)
            .setInteractive({ useHandCursor: true });
        sideZone.on('pointerdown', () => this.close());
        cont.add(sideZone);

        // (sem botao X no painel — fecha pelo X do card ou pela aba lateral)

        // o menu de categorias precisa ficar POR CIMA do grid na ordem de
        // render/input — Container ignora depth dos filhos e usa a ordem da
        // lista, entao re-adiciona no fim (ele foi criado antes do _gridCont)
        if (this._catMenu) { cont.remove(this._catMenu); cont.add(this._catMenu); }
    }

    // Atualiza coins/inventario quando o servidor reenvia PLAYER_DATA
    // (ex.: apos BUY_ITEM) sem precisar fechar e reabrir o painel.
    _onPlayerData() {
        if (!this.isOpen) return;
        const inv = this.scene.network?.inventory || [];
        this.ownedIds = new Set(inv.map(i => i.itemId));
        this._renderGrid();
    }

    _refreshTabs() {
        if (!this.tabZones) return;
        for (const z of this.tabZones) {
            const sel = z._tab === this.tab;
            z._label.setColor(sel ? '#0072ce' : '#666666');
            z._bg.clear();
            z._bg.fillStyle(sel ? 0x0072ce : 0xd0e8f7, sel ? 0.95 : 0.7);
            z._bg.fillRoundedRect(0, -6, z._bw, 12, 4);
        }
    }

    async _iconTexture(id) {
        if (this._iconTex.has(id)) return this._iconTex.get(id);
        const pm = (await assetMovie('icons', id)) || (await assetMovie('paper', id));
        if (!pm) { this._iconTex.set(id, null); return null; }
        // renderFrame resolve a timeline inteira: icones podem referenciar
        // sprites aninhados ou characters diretos (sprites:{} vazio).
        // ATENCAO: a arte do icone e centrada na origem (0,0), NAO no stage
        // 100x100 — renderizar o stage inteiro clipa metade do item. Calcula
        // os bounds reais do frame e renderiza so a regiao do conteudo.
        const scale = 3;
        const padW = 3; // margem em unidades de mundo
        const frame = pm._mainTl?.frames?.[0] || [];
        const b = pm._boundsOfEntries(frame, { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }, '');
        const W = pm.stage?.width || 100, H = pm.stage?.height || 100;
        const bx0 = b ? b[0] - padW : 0, by0 = b ? b[1] - padW : 0;
        const bx1 = b ? b[2] + padW : W, by1 = b ? b[3] + padW : H;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil((bx1 - bx0) * scale));
        canvas.height = Math.max(1, Math.ceil((by1 - by0) * scale));
        try {
            await pm.renderFrame(0, canvas, scale, -bx0, -by0);
        } catch (e) {
            console.warn(`[wardrobe] icon ${id}`, e);
            this._iconTex.set(id, null);
            return null;
        }
        const ctx = canvas.getContext('2d');
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;
        let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                if (d[(y * canvas.width + x) * 4 + 3] > 10) {
                    if (x < x0) x0 = x; if (x > x1) x1 = x;
                    if (y < y0) y0 = y; if (y > y1) y1 = y;
                }
            }
        }
        if (x1 < 0) { this._iconTex.set(id, null); return null; }
        const pad = 2;
        x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
        x1 = Math.min(canvas.width - 1, x1 + pad); y1 = Math.min(canvas.height - 1, y1 + pad);
        const cropped = document.createElement('canvas');
        cropped.width = x1 - x0 + 1; cropped.height = y1 - y0 + 1;
        cropped.getContext('2d').drawImage(canvas, x0, y0, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
        const key = `wardrobe_icon_${id}`;
        if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, cropped);
        this._iconTex.set(id, key);
        return key;
    }

    // Inventario: somente itens que o pinguim JA POSSUI (compras sao via
    // catalogos das salas). Cores gratuitas (cost 0) sempre disponiveis.
    _ownedColors() {
        return PENGUIN_COLORS.filter((c) => this.ownedIds?.has(c.id) || c.cost === 0);
    }

    _totalPages() {
        if (this.tab === 'color') {
            return Math.max(1, Math.ceil(this._ownedColors().length / (COLS * ROWS)));
        }
        return Math.max(1, Math.ceil(this._filteredItems().length / (COLS * ROWS)));
    }

    _filteredItems() {
        const q = this.search.trim().toLowerCase();
        // somente possuidos
        let items = this.items.filter((it) =>
            (this.tab === 'all' || it.slot === this.tab) && this.ownedIds?.has(it.id) && it.name);
        if (q) items = items.filter((it) => it.name.toLowerCase().includes(q));
        return items.map(it => ({ ...it, owned: true }));
    }

    async _renderGrid() {
        const scene = this.scene;
        this._gridCont.removeAll(true);
        this.cells = [];
        const look = this.penguin.gpaOutfit || {};
        const totalPages = this._totalPages();
        this.page = Phaser.Math.Clamp(this.page, 0, totalPages - 1);

        if (this.tab === 'color') {
            const colors = this._ownedColors();
            const startIdx = this.page * COLS * ROWS;
            const endIdx = Math.min(startIdx + COLS * ROWS, colors.length);
            const pageColors = colors.slice(startIdx, endIdx);
            pageColors.forEach((c, idx) => {
                const col = idx % COLS, row = Math.floor(idx / COLS);
                const x = col * (CELL_SIZE + GRID_GAP), y = row * (CELL_SIZE + GRID_GAP);
                const cell = scene.add.container(x, y);
                cell.itemId = c.id; // cores sao itens type 1 (paper_item_id)
                const bg = scene.add.graphics();
                const isSel = this.penguin.colorItemId === c.id;
                bg.fillStyle(0xffffff, 1);
                bg.fillRoundedRect(0, 0, CELL_SIZE, CELL_SIZE, 8);
                bg.lineStyle(2, isSel ? 0x2fb344 : 0xc8c8c8, 1);
                bg.strokeRoundedRect(0, 0, CELL_SIZE, CELL_SIZE, 8);
                cell.add([bg]);
                // cores sao itens equipaveis: icone real do pack icons/<id>
                // (mesmo padrao das celulas de roupa); fallback = circulo
                // colorido para ids sem icone upstream (ex.: 17 Dot Lavender)
                this._iconTexture(c.id).then((key) => {
                    if (cell.destroyed) return;
                    if (key) {
                        const img = scene.add.image(CELL_SIZE / 2, CELL_SIZE / 2, key);
                        const tex = scene.textures.get(key);
                        const scale = Math.min((CELL_SIZE - 14) / tex.source[0].width,
                            (CELL_SIZE - 16) / tex.source[0].height);
                        img.setScale(scale);
                        cell.addAt(img, 1);
                    } else {
                        const dot = scene.add.graphics();
                        dot.fillStyle(c.color, 1);
                        dot.fillCircle(CELL_SIZE / 2, CELL_SIZE / 2, 12);
                        dot.lineStyle(1, 0xffffff, 0.6);
                        dot.strokeCircle(CELL_SIZE / 2, CELL_SIZE / 2, 12);
                        cell.addAt(dot, 1);
                    }
                });
                // hit area: zone invisivel — Container.setInteractive tem
                // quirk de hit-test com containers aninhados (cliques nas
                // bordas falhavam/selecionavam o vizinho); zones sao o mesmo
                // padrao usado na pill/menu/scroll e funcionam sempre
                const z = scene.add.zone(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE, CELL_SIZE)
                    .setInteractive({ useHandCursor: true });
                z.on('pointerdown', () => this._pickColor(c));
                cell.add(z);
                this._gridCont.add(cell);
                this.cells.push(cell);
            });
        } else {
            const slotItems = this._filteredItems();
            const startIdx = this.page * COLS * ROWS;
            const endIdx = Math.min(startIdx + COLS * ROWS, slotItems.length);
            const pageItems = slotItems.slice(startIdx, endIdx);

            pageItems.forEach((item, idx) => {
                const col = idx % COLS, row = Math.floor(idx / COLS);
                const x = col * (CELL_SIZE + GRID_GAP), y = row * (CELL_SIZE + GRID_GAP);
                const cell = scene.add.container(x, y);
                const bg = scene.add.graphics();
                const equipped = look[item.slot] === item.id;
                bg.fillStyle(0xffffff, 1);
                bg.fillRoundedRect(0, 0, CELL_SIZE, CELL_SIZE, 8);
                bg.lineStyle(equipped ? 3 : 2, equipped ? 0x2fb344 : 0xc8c8c8, 1);
                bg.strokeRoundedRect(0, 0, CELL_SIZE, CELL_SIZE, 8);
                cell.add(bg);
                const z = scene.add.zone(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE, CELL_SIZE)
                    .setInteractive({ useHandCursor: true });
                z.on('pointerdown', () => this._pickItem(item));
                cell.add(z);
                this._gridCont.add(cell);
                this.cells.push(cell);
                // grade original: somente o icone (sem rotulo de nome)
                this._iconTexture(item.id).then((key) => {
                    if (!key || cell.destroyed) return;
                    const img = scene.add.image(CELL_SIZE / 2, CELL_SIZE / 2, key);
                    const tex = scene.textures.get(key);
                    const srcW = tex.source[0].width;
                    const srcH = tex.source[0].height;
                    const scale = Math.min((CELL_SIZE - 14) / srcW, (CELL_SIZE - 16) / srcH);
                    img.setScale(scale);
                    cell.addAt(img, 1);
                });
            });
        }

        this._gridCont.setPosition(this._gridX, this._gridY);
    }

    _updatePill() {
        if (this._pillText) this._pillText.setText(this._catName?.(this.tab) || this.tab);
    }

    _toggleCatMenu() {
        if (!this._catMenu) return;
        const open = !this._catMenu.visible;
        this._catMenu.setVisible(open);
        if (open) {
            // destaca a categoria ativa no menu
            for (const c of this._catMenu.list) {
                if (c._mt) c._mt.setColor(c._cat === this.tab ? '#0072ce' : '#333333');
            }
        }
    }

    _prevPage() {
        if (this.page > 0) {
            this.page--;
            this._renderGrid();
        }
    }

    _nextPage() {
        const totalPages = this._totalPages();
        if (this.page < totalPages - 1) {
            this.page++;
            this._renderGrid();
        }
    }

    _promptSearch() {
        if (this.search) {
            this.search = '';
            this.page = 0;
            this._renderGrid();
        }
    }

    _pickItem(item) {
        // inventario: somente equipa/desequipa (compra e via catalogo)
        const current = this.penguin.gpaOutfit?.[item.slot];
        const next = current === item.id ? null : item.id;
        this.penguin.equip(item.slot, next);
        this.scene.network?.sendEquip(item.slot, next);
        // atualiza o player card também (repaint do doll)
        if (this.scene.playerCard?.penguin === this.penguin) {
            this.scene.playerCard._refresh?.();
        }
        this._renderGrid();
    }

    _pickColor(colorInfo) {
        // inventario: somente equipa (compra e via catalogo)
        this.penguin.setColorItemId?.(colorInfo.id);
        this.scene.network?.sendColor?.(colorInfo.id);
        this._renderGrid();
    }

}
