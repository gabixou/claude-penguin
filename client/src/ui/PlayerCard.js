// PlayerCard.js — janela de perfil do pinguim (player card do Club Penguin).
// Renderiza o sprite 701 (aba paperdoll) do pacote /assets/movies/interface
// via Clip, sobrepoe o nome (name_txt -> texto Phaser) e um preview do
// pinguim renderizado com PenguinView (mesmo pipeline vetorial da sala).
import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { veColor } from '../entities/PenguinArt.js';
import { WORLD_W, WORLD_H } from '../display.js';
import NameChangeModal from './NameChangeModal.js';

const CARD_SPRITE_ID = '701';
const CARD_FRAME_SELF = 2; // frame 3 = aba de inventario aberta (painel branco lateral)
const CARD_FRAME_OTHER = 1; // frame 2 = card normal com botoes sociais
const RENDER_SCALE = 3;     // supersampling do canvas da janela
const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

// botoes da fileira inferior do card (nome -> acao); coords relativas ao sprite
const CARD_BUTTONS = {
    close_btn: 'close',
    ignore_mc: 'ignore',
    report_mc: 'report',
    buddy_mc: 'buddy',
    home_mc: 'home',
    profile_mc: 'profile',
    mail_mc: 'mail',
    stamps_mc: 'stamps',
    tab_btn: 'inventory', // frame 2: botao de inventario (painel branco lateral)
    sort_mc: 'sort', // frame 3: menu de categorias
    next_btn: 'next',
    back_btn: 'back',
};

// ordem de desenho do paperdoll no card (io do layoutBalloon original:
// feet, body, neck, face, head, hand — de baixo para cima)
const PAPER_ORDER = ['feet', 'body', 'neck', 'face', 'head', 'hand'];

// cache de MovieRoom dos packs clothing/paper/<id> (vista frontal)
const _paperMovies = new Map();
function paperMovie(id) {
    if (!_paperMovies.has(id)) {
        _paperMovies.set(id, MovieRoom.load(`/assets/paper/${id}`)
            .then((m) => { m.setScale(1); return m; })
            .catch((e) => { console.warn('[playercard] paper', id, e); _paperMovies.delete(id); return null; }));
    }
    return _paperMovies.get(id);
}

// cache de MovieRoom dos packs card (photos/<id> = fundo, icons/<id> = pin)
const _photoMovies = new Map();
const _iconMovies = new Map();
function assetMovieCached(kind, cache, id) {
    if (!cache.has(id)) {
        cache.set(id, MovieRoom.load(`/assets/${kind}/${id}`)
            .then((m) => { m.setScale(1); return m; })
            .catch((e) => { console.warn('[playercard]', kind, id, e); cache.delete(id); return null; }));
    }
    return cache.get(id);
}
const photoMovie = (id) => assetMovieCached('photos', _photoMovies, id);
const iconMovie = (id) => assetMovieCached('icons', _iconMovies, id);

export default class PlayerCard {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.dim = null;
        this.penguin = null;
        this._moviePromise = null;
        this.nameChangeModal = new NameChangeModal(scene);
    }

    // MovieRoom do interface pack — carregado lazy, uma vez por sessao.
    _movie() {
        if (!this._moviePromise) {
            this._moviePromise = MovieRoom.load('/assets/movies/interface')
                .then((m) => { m.setScale(1); return m; })
                .catch((e) => { console.warn('[playercard] interface load', e); return null; });
        }
        return this._moviePromise;
    }

    get isOpen() { return !!this.container; }

    async open(penguin) {
        if (this.isOpen) this.close();
        this.penguin = penguin;
        const movie = await this._movie();
        if (!movie || !this.scene.sys.isActive()) return;
        this._build(movie, penguin);
    }

    close() {
        // marca o instante do fechamento: o pointerdown que fechou o card
        // nao deve ser interpretado pelo RoomScene como clique de movimento
        // (senao o pinguim anda / reabre card se o clique pegou um pinguim)
        if (this.scene?.time) this.scene._pcardClosedAt = this.scene.time.now;
        // fecha o wardrobe junto (se estiver aberto)
        this.scene?.wardrobe?.close();
        if (this.dim) { this.dim.destroy(); this.dim = null; }
        if (this.container) { this.container.destroy(true); this.container = null; }
        this.penguin = null;
    }

    async _build(movie, penguin) {
        const scene = this.scene;
        const clip = new Clip(movie);
        const sp = movie.sprites[CARD_SPRITE_ID];
        const isSelf = penguin === scene.localPlayer
            || (scene.localPlayer && penguin.playerId === scene.localPlayer.playerId);
        const frameIndex = isSelf ? CARD_FRAME_SELF : CARD_FRAME_OTHER;
        const entries = sp?.frames?.[frameIndex];
        if (!entries) { console.warn('[playercard] sprite 701 frame ausente'); return; }

        // esconde o placeholder do paperdoll (desenhamos o pinguim real por cima)
        clip.set('paper_doll_mc', { visible: false });
        // photo_mc/flag_mc NAO sao escondidos: sao os anchors dos cosmeticos
        // (fundo type 9 / pin type 8) — desenhamos por cima deles no paint()
        // esconde o "Your Coins: 000000" estatico — o valor real e desenhado
        // como texto Phaser na posicao nativa do coins_txt (ver abaixo)
        clip.set('coins_txt', { visible: false });

        // bounds do frame em coords do sprite -> canvas
        const b = clip._boundsOf(entries, IDENT, '') || [0, 0, 240, 300];
        const w = Math.ceil(b[2] - b[0]), h = Math.ceil(b[3] - b[1]);
        const cw = w * RENDER_SCALE, ch = h * RENDER_SCALE;
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext('2d');

        // ---- paperdoll frontal (como o GoPenguin: paper_doll_mc.body com a
        // cor do jogador + outline + roupas clothing/paper/<id> no mesmo
        // anchor 110.7,142.9, na ordem feet->body->neck->face->head->hand) ----
        const dollEntry = entries.find((e) => e.name === 'paper_doll_mc');
        const dollFrame = dollEntry && movie.sprites[String(dollEntry.id)]?.frames?.[0];
        let dollWorld = null, bodyE = null, outlineE = null;
        const look = penguin.gpaOutfit || {};
        if (dollFrame) {
            // world = matriz do paper_doll_mc (coords do filho -> frame do
            // sprite 701); o _drawListFrame compoe com o transform do ctx
            // (escala RENDER_SCALE + offset dos bounds) — NAO pré-multiplicar
            const dm = dollEntry.matrix || [1, 0, 0, 1, 0, 0];
            dollWorld = { a: dm[0], b: dm[1], c: dm[2], d: dm[3], x: dm[4], y: dm[5] };
            bodyE = dollFrame.find((e) => e.name === 'body');
            outlineE = dollFrame.find((e) => e.name === 'outline');
        }

        // ---- cosmeticos do card (port do gp): photo_mc = fundo (item type 9,
        // pack photos/<id> desenhado na matriz do photo_mc) e flag_mc = pin
        // (item type 8, pack icons/<id> na matriz do flag_mc com scale 0.66) ----
        const photoE = entries.find((e) => e.name === 'photo_mc');
        const flagE = entries.find((e) => e.name === 'flag_mc');
        const toWorld = (m, s = 1) => ({ a: (m?.[0] ?? 1) * s, b: (m?.[1] ?? 0) * s, c: (m?.[2] ?? 0) * s, d: (m?.[3] ?? 1) * s, x: m?.[4] ?? 0, y: m?.[5] ?? 0 });
        const photoWorld = photoE && toWorld(photoE.matrix);
        // gp: pin usa scale 0.66 na posicao do flag_mc (Ns = [.66,0,0,.66,34.2,83])
        const flagWorld = flagE && toWorld(flagE.matrix, 0.66);

        // repinta o canvas inteiro; withPapers=false mostra o card ja com o
        // pinguim base (corpo+outline) enquanto as roupas carregam em background
        // z-order fiel ao Flash: o photo_mc (depth 33) fica logo apos o
        // fundo — a foto deve renderizar ATRAS de badge/botoes/papel, so
        // dentro do retangulo reservado (parte azul escura do card).
        const photoDepth = photoE ? (photoE.depth ?? 0) : -1;
        const beforePhoto = photoE ? entries.filter((e) => (e.depth ?? 0) <= photoDepth) : entries;
        const afterPhoto = photoE ? entries.filter((e) => (e.depth ?? 0) > photoDepth) : [];

        const paint = async (withPapers) => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cw, ch);
            ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, -b[0] * RENDER_SCALE, -b[1] * RENDER_SCALE);
            await clip._drawListFrame(ctx, beforePhoto, IDENT, '', IDENT_COLOR, RENDER_SCALE);
            // fundo do card (photo type 9): clipado no retangulo do photo_mc
            // (sprite 600 = janela 205.2x203.45 na origem do photo_mc)
            const photoId = Number(look.photo);
            if (photoWorld && photoId) {
                const pm = await photoMovie(photoId);
                if (pm) {
                    const pclip = new Clip(pm);
                    ctx.save();
                    // janela do photo em coords do card: bounds do conteudo
                    // do sprite do photo_mc (ex.: sprite 600 = janela azul)
                    // composados com a matrix do photo_mc
                    const spId = String(photoE.id);
                    const spr = movie.sprites?.[spId];
                    const sprFrame = spr?.frames?.[0] || [];
                    const wm = photoE.matrix || [1, 0, 0, 1, 0, 0];
                    const wmat = { a: wm[0], b: wm[1], c: wm[2], d: wm[3], x: wm[4], y: wm[5] };
                    const wb = clip._boundsOf(sprFrame, wmat, '');
                    if (wb) {
                        ctx.beginPath();
                        ctx.rect(wb[0], wb[1], wb[2] - wb[0], wb[3] - wb[1]);
                        ctx.clip();
                    }
                    await pclip._drawListFrame(ctx, pm._mainTl?.frames?.[0] || [],
                        photoWorld, '', IDENT_COLOR, RENDER_SCALE);
                    ctx.restore();
                }
            }
            await clip._drawListFrame(ctx, afterPhoto, IDENT, '', IDENT_COLOR, RENDER_SCALE);
            if (dollWorld) try {
                if (bodyE) {
                    await clip._drawListFrame(ctx, [bodyE], dollWorld, '',
                        veColor(penguin.penguinColor || 0x000000), RENDER_SCALE);
                }
                if (outlineE) {
                    await clip._drawListFrame(ctx, [outlineE], dollWorld, '', IDENT_COLOR, RENDER_SCALE);
                }
                if (withPapers) {
                    for (const slot of PAPER_ORDER) {
                        const id = Number(look[slot]);
                        if (!id) continue;
                        const pm = await paperMovie(id);
                        if (!pm) continue;
                        const pclip = new Clip(pm);
                        await pclip._drawListFrame(ctx, pm.data?.main?.frames?.[0] || [],
                            dollWorld, '', IDENT_COLOR, RENDER_SCALE);
                    }
                }
            } catch (e) { console.warn('[playercard] paperdoll', e); }
            // pin (flag type 8): movie icons/<id> na matriz do flag_mc (scale .66)
            const flagId = Number(look.flag);
            if (flagWorld && flagId) {
                const pm = await iconMovie(flagId);
                if (pm) {
                    const pclip = new Clip(pm);
                    await pclip._drawListFrame(ctx, pm._mainTl?.frames?.[0] || [],
                        flagWorld, '', IDENT_COLOR, RENDER_SCALE);
                }
            }
        };

        await paint(false);

        // ---- container ----
        const cx = WORLD_W / 2, cy = WORLD_H / 2;
        const scale = Math.min(1, 480 / h); // cabe em ~480px de altura
        const dw = w * scale, dh = h * scale;
        const cont = scene.add.container(cx - dw / 2, cy - dh / 2).setDepth(20000000);
        this.container = cont;

        const texKey = `playercard_${Date.now()}`;
        scene.textures.addCanvas(texKey, canvas);
        cont.add(scene.add.image(0, 0, texKey).setOrigin(0, 0).setDisplaySize(dw, dh));

        // helper: coords do sprite -> coords do container
        const px = (sx, sy) => [(sx - b[0]) * scale, (sy - b[1]) * scale];

        // ---- nome (name_txt: font 176 = Arial Bold 16, cor #000, centralizado) ----
        const nameEntry = entries.find((e) => e.name === 'name_txt');
        if (nameEntry) {
            const m = nameEntry.matrix || [1, 0, 0, 1, 0, 0];
            const [nx, ny] = px(m[4] + 81, m[5] + 13); // centro da caixa 162x25
            cont.add(scene.add.text(nx, ny, penguin.username || penguin.playerId, {
                fontFamily: 'Arial, sans-serif', fontSize: `${16 * scale}px`,
                fontStyle: 'bold', color: '#000000', align: 'center',
            }).setOrigin(0.5));
        }

        // ---- botoes ----
        for (const e of entries) {
            const action = CARD_BUTTONS[e.name];
            if (!action) continue;
            // self: card proprio mostra painel de inventario nativo do pack
            // (tab_btn frame 2: painel branco lateral; sort_mc/next/back frame 3:
            // menu de categorias) — por enquanto abre o guarda-roupa vetorial
            // como placeholder; implementacao real usaria o menu_mc_holder
            // e o painel branco lateral (tab_mc) do interface pack
            if (isSelf && action !== 'close' && action !== 'inventory' && action !== 'sort' && action !== 'next' && action !== 'back') continue;
            const eb = clip._boundsOf([e], IDENT, '');
            if (!eb) continue;
            const [bx, by] = px((eb[0] + eb[2]) / 2, (eb[1] + eb[3]) / 2);
            const bw = (eb[2] - eb[0]) * scale, bh = (eb[3] - eb[1]) * scale;
            const zone = scene.add.zone(bx, by, Math.max(bw, 22 * scale), Math.max(bh, 22 * scale))
                .setInteractive({ useHandCursor: true });
            zone.name = `pcard_${action}`;
            zone.on('pointerdown', () => this._button(action));
            cont.add(zone);
        }

        // self: clicar no boneco tambem abre o guarda-roupa (sem fechar o card)
        if (isSelf && dollWorld) {
            const [dx2, dy2] = px(dollWorld.x + 55, dollWorld.y + 60);
            const dz = scene.add.zone(dx2, dy2, 120 * scale, 150 * scale)
                .setInteractive({ useHandCursor: true });
            dz.on('pointerdown', () => { scene.wardrobe?.open(scene.localPlayer); });
            cont.add(dz);
        }

        // Botão de renomear (apenas para o jogador local e se canRename)
        if (isSelf && scene.network?.canRename) {
            const renameY = cy + dh / 2 - 20;
            const renameBtn = scene.add.container(cx, renameY);
            const renameBg = scene.add.graphics();
            renameBg.fillStyle(0xffcc00, 1);
            renameBg.fillRoundedRect(-40, -12, 80, 24, 4);
            renameBg.lineStyle(1, 0x000000, 0.3);
            renameBg.strokeRoundedRect(-40, -12, 80, 24, 4);
            const renameText = scene.add.text(0, 0, 'Rename', {
                fontFamily: 'GoPenguin, Arial, sans-serif',
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#000000',
            }).setOrigin(0.5);
            renameBtn.add([renameBg, renameText]);
            renameBtn.setSize(80, 24);
            renameBtn.setInteractive(new Phaser.Geom.Rectangle(-40, -12, 80, 24), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
            renameBtn.on('pointerdown', () => this.nameChangeModal.open());
            cont.add(renameBtn);
        }

        // Coins do jogador local — editText nativo coins_txt (id 667:
        // "Your Coins: N", font 190 size 12, align left) posicionado ao lado
        // do icone de moeda (#141/#142) no rodape esquerdo do card
        if (isSelf) {
            const coinsEntry = entries.find((e) => e.name === 'coins_txt');
            if (coinsEntry) {
                const m = coinsEntry.matrix || [1, 0, 0, 1, 0, 0];
                // icone de moeda (#141/#142) centralizado em ~(30.8, 256.5)
                // no espaco do sprite — alinha a altura do texto a esse centro
                const [tx, ty] = px(m[4] - 2, 256.5);
                this._coinsText = scene.add.text(tx, ty,
                    `Your Coins: ${scene.network?.coins || 0}`, {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: `${12 * scale}px`,
                        color: '#000000',
                    }).setOrigin(0, 0.5);
                cont.add(this._coinsText);
            }
        }

        // fundo escurecido (fecha ao clicar fora)
        this.dim = scene.add.rectangle(cx, cy, WORLD_W, WORLD_H, 0x000000, 0.45)
            .setOrigin(0.5).setDepth(19999999).setInteractive();
        this.dim.on('pointerdown', () => this.close());

        // guarda a funcao de repaint para _refresh() (wardrobe equipa itens)
        this._repaint = async () => {
            if (this.container !== cont) return;
            if (this._coinsText) {
                this._coinsText.setText(`Your Coins: ${scene.network?.coins || 0}`);
            }
            await paint(true);
            if (this.container === cont && scene.textures.exists(texKey)) {
                scene.textures.get(texKey).refresh();
            }
        };

        // roupas chegam em background: quando todas as papers carregarem,
        // repinta o canvas (frame + doll + roupas) e atualiza a textura
        const hasPapers = PAPER_ORDER.some((s) => Number(look[s]));
        if (hasPapers && dollWorld) {
            const ids = [...new Set(PAPER_ORDER.map((s) => Number(look[s])).filter(Boolean))];
            Promise.all(ids.map((id) => paperMovie(id)))
                .then(async () => {
                    if (this.container !== cont) return; // card fechou/trocou
                    await paint(true);
                    if (this.container === cont && scene.textures.exists(texKey)) {
                        scene.textures.get(texKey).refresh();
                    }
                })
                .catch((e) => console.warn('[playercard] papers', e));
        }
    }

    // repinta o doll quando o wardrobe equipa/desequipa itens
    _refresh() {
        if (!this.container || !this.penguin) return;
        // re-renderiza o canvas do card com as novas roupas
        this._repaint?.();
    }

    _button(action) {
        const scene = this.scene;
        switch (action) {
            case 'close': this.close(); break;
            case 'inventory':
            case 'sort':
            case 'profile':
                // abre o wardrobe ao lado do card (sem fechar o card)
                if (this.penguin === scene.localPlayer) {
                    scene.wardrobe?.open(scene.localPlayer);
                }
                break;
            case 'next':
            case 'back':
                // TODO: paginacao do inventario nativo (menu_mc_holder + sort_mc)
                break;
            case 'rename':
                // renomeia o jogador local (uma vez)
                if (this.penguin === scene.localPlayer && scene.network?.canRename) {
                    this.nameChangeModal.open();
                }
                break;
            case 'ignore':
            case 'report':
            case 'buddy':
            case 'home':
            case 'mail':
            case 'stamps':
                // acoes sociais ainda nao tem suporte no backend — so feedback
                if (this.penguin) {
                    scene.localPlayer?.showChat?.(`(${action} em ${this.penguin.username} — em breve)`);
                }
                break;
        }
    }
}
