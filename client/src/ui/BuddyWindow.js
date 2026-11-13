// BuddyWindow.js — Buddy List vetorial do Club Penguin original.
// Renderiza interface_mc.widgets_mc.buddy_mc.art_mc (sprite 502) do pack
// /assets/movies/interface via Clip — mesma arvore do gopenguin.lol:
//   title_txt / buddy_total_txt / item0..7_mc{name_txt,icon_mc,item_btn}
//   + botoes buddy_btn / online_btn / ignore_btn (abas), close/next/back.
// Textos dinamicos sao sobrepostos em Phaser (o pipeline vetorial so
// rasteriza o SVG baked); icones usam frames do sprite 487
// (Offline=1 Online=2 Player=4 Ignore=6 — labels do pack).

import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { WORLD_W, WORLD_H } from '../display.js';

const SCALE = 2;
const ROOT = [1, 0, 0, 1, 460, 80];           // matrix do buddy_mc no stage
const ART_ID = '502';                          // sprite do art_mc
const ITEM_ID = '501';                         // sprite do itemN_mc
const ROWS = 8;
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

// matrix [a,b,c,d,x,y] -> {a,b,c,d,x,y}; compose world∘local (mesma ordem do clip.js)
const arrM = (m) => ({ a: m[0], b: m[1], c: m[2], d: m[3], x: m[4], y: m[5] });
const mulM = (p, q) => ({
    a: p.a * q.a + p.c * q.b, b: p.b * q.a + p.d * q.b,
    c: p.a * q.c + p.c * q.d, d: p.b * q.c + p.d * q.d,
    x: p.a * q.x + p.c * q.y + p.x, y: p.b * q.x + p.d * q.y + p.y,
});
const ROOT_M = arrM(ROOT);

const TITLES = { buddies: 'Buddy List', room: 'Players in Room', blocked: 'Ignore List' };
// icone do sprite 487 por tipo de linha
const ICON_FRAME = { online: 2, offline: 1, player: 4, ignore: 6, request: 7, pending: 5 };

export default class BuddyWindow {
    constructor(scene) {
        this.scene = scene;
        this.open_ = false;
        this.tab = 'buddies';
        this.page = 0;
        this._ready = false;
        this._buildDom();
        scene.events.on('social-update', () => { if (this.open_) this.render(); });
        scene.events.on('buddy-request', () => { if (this.open_) this.render(); });
        scene.events.on('player-joined', () => { if (this.open_ && this.tab === 'room') this.render(); });
        scene.events.on('player-left', () => { if (this.open_ && this.tab === 'room') this.render(); });
        scene.events.once('shutdown', () => this.destroy());
        this._init();
    }

    _buildDom() {
        // container Phaser fica invisivel ate o movie carregar
        // acima do HUD (10M) e elementos de sala (~1M); abaixo de
        // PlayerCard/IslandMap (20M) e prompt (21M)
        this.container = this.scene.add.container(0, 0).setDepth(15000000).setVisible(false);
    }

    async _init() {
        try {
            if (!this.scene.game._interfaceMoviePromise) {
                this.scene.game._interfaceMoviePromise = MovieRoom.load('/assets/movies/interface')
                    .then((m) => { m.setScale?.(1); return m; });
            }
            const movie = await this.scene.game._interfaceMoviePromise;
            if (!movie || !this.scene.sys.isActive()) return;
            this.movie = movie;
            this.clip = new Clip(movie);
            this.sprites = movie.sprites || {};
            this.art = this.sprites[ART_ID]?.frames?.[0] || [];
            this.itemFrame = this.sprites[ITEM_ID]?.frames?.[0] || [];
            this._computeLayout();
            this._buildVisuals();
            this._ready = true;
            if (this.open_) this.render();
        } catch (e) {
            console.warn('[buddywindow] init', e);
        }
    }

    // posicoes dos elementos (coords de stage 760x480) via _boundsOf do Clip
    _computeLayout() {
        const c = this.clip;
        this.winBounds = c._boundsOf(this.art, ROOT_M, '') || [460, 80, 692, 390];
        const find = (n) => this.art.find((e) => e.name === n);
        const b = (entries, world, path) => c._boundsOf(entries, world, path);
        this.elems = {};
        for (const n of ['title_txt', 'buddy_total_txt', 'close_btn', 'buddy_btn', 'online_btn', 'ignore_btn', 'next_btn', 'back_btn']) {
            const e = find(n);
            this.elems[n] = e ? b([e], ROOT_M, '') : null;
        }
        // linhas: world = ROOT * matrix do itemN_mc; filhos com path 'itemN_mc'
        this.rows = [];
        for (let i = 0; i < ROWS; i++) {
            const e = find(`item${i}_mc`);
            if (!e) { this.rows.push(null); continue; }
            const w = mulM(ROOT_M, arrM(e.matrix || [1, 0, 0, 1, 0, 0]));
            const row = { entry: e, world: w, children: {} };
            for (const ch of this.itemFrame) {
                if (!ch.name) continue;
                row.children[ch.name] = b([ch], w, `item${i}_mc`);
            }
            this.rows.push(row);
        }
    }

    _center(b) { return b ? { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 } : { x: 0, y: 0 }; }

    _buildVisuals() {
        const scene = this.scene;
        // posicao autenticada: o art_mc ja vem com matrix (460,80) no stage —
        // nao centralizar; textos/zonas usam os bounds direto (mesmo espaco).
        this.ox = 0;
        this.oy = 0;
        const P = (x, y) => ({ x: x + this.ox, y: y + this.oy });

        // canvas da arte vetorial (redesenhado a cada render)
        this.canvas = document.createElement('canvas');
        this.canvas.width = WORLD_W * SCALE;
        this.canvas.height = WORLD_H * SCALE;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        this.texKey = `buddywin_${Date.now()}`;
        scene.textures.addCanvas(this.texKey, this.canvas);
        this.img = scene.add.image(0, 0, this.texKey).setOrigin(0, 0)
            .setDisplaySize(WORLD_W, WORLD_H);
        this.container.add(this.img);

        // textos dinamicos (branco bold — estilo dos campos do SWF)
        const mkText = (b, size = 13) => {
            const c = this._center(b);
            const t = scene.add.text(c.x + this.ox, c.y + this.oy, '', {
                fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold',
                color: '#ffffff', stroke: '#1c3a5e', strokeThickness: 2,
            }).setOrigin(0.5);
            this.container.add(t);
            return t;
        };
        this.titleText = mkText(this.elems.title_txt, 15);
        this.totalText = mkText(this.elems.buddy_total_txt, 12);
        this.rowTexts = [];
        for (let i = 0; i < ROWS; i++) {
            const nb = this.rows[i]?.children.name_txt;
            this.rowTexts.push(nb ? mkText(nb, 12) : null);
        }

        // zonas de clique (coords de stage -> container)
        const zone = (b, fn) => {
            if (!b) return;
            const c = this._center(b);
            const w = Math.max(b[2] - b[0], 18), h = Math.max(b[3] - b[1], 14);
            const z = scene.add.zone(c.x + this.ox, c.y + this.oy, w, h)
                .setInteractive({ useHandCursor: true });
            z.on('pointerdown', fn);
            this.container.add(z);
        };
        zone(this.elems.close_btn, () => this.close());
        zone(this.elems.buddy_btn, () => this._setTab('buddies'));
        zone(this.elems.online_btn, () => this._setTab('room'));
        zone(this.elems.ignore_btn, () => this._setTab('blocked'));
        zone(this.elems.next_btn, () => { this.page++; this.render(); });
        zone(this.elems.back_btn, () => { this.page = Math.max(0, this.page - 1); this.render(); });

        // zonas dos itens — recriadas por pagina em _syncRows()
        this.itemZones = [];
        this.container.setVisible(false);
    }

    _setTab(t) { this.tab = t; this.page = 0; this.render(); }

    // monta as linhas da aba atual (mesmos "kinds" do gopenguin)
    _list() {
        const net = this.scene.network;
        const s = net?.social || {};
        if (this.tab === 'room') {
            const out = [];
            for (const p of this.scene.remotePlayers?.values() || []) {
                out.push({ name: p.username, kind: 'player', playerId: p.playerId, penguin: p });
            }
            return out;
        }
        if (this.tab === 'blocked') {
            return (s.ignores || []).map((i) => ({ name: i.username, kind: 'ignore', playerId: i.playerId }));
        }
        // buddies: pedidos recebidos/enviados + amigos
        const out = [];
        for (const r of s.requests || []) {
            if (r.direction === 'received') out.push({ name: `${r.username} (request)`, kind: 'request', playerId: r.playerId });
            else out.push({ name: `${r.username} (pending)`, kind: 'pending', playerId: r.playerId });
        }
        for (const b of s.buddies || []) {
            out.push({ name: b.username, kind: b.online ? 'online' : 'offline', playerId: b.playerId });
        }
        return out;
    }

    async render() {
        if (!this._ready) return;
        const list = this._list();
        const pages = Math.max(1, Math.ceil(list.length / ROWS));
        this.page = Math.min(this.page, pages - 1);
        const slice = list.slice(this.page * ROWS, this.page * ROWS + ROWS);

        // estado do clip: visibilidade dos icones + frame + textos ocultos
        const c = this.clip;
        c.set('title_txt', { visible: false });
        c.set('buddy_total_txt', { visible: false });
        for (let i = 0; i < ROWS; i++) {
            const row = slice[i];
            const base = `item${i}_mc`;
            c.set(`${base}.name_txt`, { visible: false });
            c.set(`${base}.icon_mc`, row ? { visible: true, frame: ICON_FRAME[row.kind] ?? 5 } : { visible: false });
        }
        // redesenha a arte vetorial
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
        await c._drawListFrame(this.ctx, this.art, ROOT_M, '', IDENT_COLOR, SCALE);
        this.scene.textures.get(this.texKey)?.refresh();

        // textos
        this.titleText.setText(TITLES[this.tab] || 'Buddy List');
        this.totalText.setText(`${list.length}/100`);
        for (let i = 0; i < ROWS; i++) {
            const t = this.rowTexts[i];
            if (t) t.setText(slice[i]?.name ?? '');
        }
        this._syncRowZones(slice);
    }

    _syncRowZones(slice) {
        // remove zonas antigas
        for (const z of this.itemZones) z.destroy();
        this.itemZones = [];
        slice.forEach((row, i) => {
            const r = this.rows[i];
            const b = r?.children.item_btn;
            if (!b) return;
            const c = this._center(b);
            const w = Math.max(b[2] - b[0], 30), h = Math.max(b[3] - b[1], 18);
            const z = this.scene.add.zone(c.x + this.ox, c.y + this.oy, w, h)
                .setInteractive({ useHandCursor: true });
            z.on('pointerdown', () => this._rowAction(row));
            this.container.add(z);
            this.itemZones.push(z);
        });
    }

    _rowAction(row) {
        const scene = this.scene;
        if (!row) return;
        if (row.kind === 'request') {
            scene.network?.buddyAccept(row.playerId);
            return;
        }
        if (row.kind === 'ignore') {
            scene.network?.ignoreRemove(row.playerId);
            return;
        }
        // buddies/room/pending: abre o player card se o pinguim esta na sala
        if (row.penguin && scene.playerCard) {
            scene.playerCard.open(row.penguin);
        } else {
            const p = scene.remotePlayers?.get(row.playerId);
            if (p && scene.playerCard) scene.playerCard.open(p);
            else scene.localPlayer?.showChat?.(`(${row.name} is not in this room)`);
        }
    }

    toggle() {
        if (!this._ready) { if (!this.open_) this.open(); return; }
        this.open_ ? this.close() : this.open();
    }

    open() {
        this.open_ = true;
        this.container.setVisible(true);
        this.scene.network?.getSocial();
        this.render();
    }

    close() {
        this.open_ = false;
        this.container.setVisible(false);
    }

    destroy() {
        this.container?.destroy();
    }
}
