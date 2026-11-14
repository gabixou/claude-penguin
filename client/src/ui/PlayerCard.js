// PlayerCard.js — janela de perfil do pinguim (player card do Club Penguin).
// Renderiza o sprite 701 (aba paperdoll) do pacote /assets/movies/interface
// via Clip, sobrepoe o nome (name_txt -> texto Phaser) e um preview do
// pinguim renderizado com PenguinView (mesmo pipeline vetorial da sala).
import Phaser from 'phaser';
import { MovieRoom } from '../movie/movie.js';
import { Clip } from '../movie/clip.js';
import { veColor } from '../entities/PenguinArt.js';
import { SPECIES_SPRITE } from '../entities/PuffleView.js';
import { WORLD_W, WORLD_H } from '../display.js';
import NameChangeModal from './NameChangeModal.js';
import { UiTooltip } from './Tooltip.js';

const CARD_SPRITE_ID = '701';
const CARD_FRAME_SELF = 2; // frame 3 = aba de inventario aberta (painel branco lateral)
const CARD_FRAME_OTHER = 1; // frame 2 = card normal com botoes sociais
const RENDER_SCALE = 3;     // supersampling do canvas da janela
const IDENT = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
const IDENT_COLOR = { mult: [1, 1, 1, 1], add: [0, 0, 0, 0] };

// Posicao do card escolhida pelo jogador (deslocamento do centro da tela),
// lembrada entre aberturas e sessoes
const CARD_POS_KEY = 'penguin_card_offset';
let _cardOffset = (() => {
    try {
        const o = JSON.parse(localStorage.getItem(CARD_POS_KEY) || 'null');
        if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) return o;
    } catch { /* sem storage */ }
    return { x: 0, y: 0 };
})();

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
    moderatorButtonEditPlayer: 'rename', // botao "?" abaixo do X (self)
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

// puffle equipado no card (variante doll com pet): sprite real
// /assets/puffle/<cor>, frame 1 = stand frontal
const _puffleMovies = new Map();
function puffleMovie(dir) {
    if (!_puffleMovies.has(dir)) {
        _puffleMovies.set(dir, MovieRoom.load(`/assets/puffle/${dir}`)
            .then((m) => { m.setScale(1); return m; })
            .catch((e) => { console.warn('[playercard] puffle', dir, e); _puffleMovies.delete(dir); return null; }));
    }
    return _puffleMovies.get(dir);
}

// lapis branco diagonal (silhueta estilo icone edit: cap quadrado no
// quadrante sup-dir, corpo retangular, ponta triangular no inf-esq) —
// substitui o glifo "?" (char 665.svg) do botao moderatorButtonEditPlayer.
// Mesma viewBox/pegada do original (10x13.2, grupo centrado em 5,7.2); so
// esse botao usa o char 665 no pack interface.
const PENCIL_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" height="13.2px" width="10.0px">
  <g transform="matrix(1.0, 0.0, 0.0, 1.0, 5.0, 7.2)">
    <g transform="rotate(45)">
      <path fill="#ffffff" d="M-1.5 -6.4 H1.5 V-4.7 H-1.5 Z"/>
      <path fill="#ffffff" d="M-1.7 -4.7 H1.7 V4.3 H-1.7 Z"/>
      <path fill="#ffffff" d="M0 6.3 L1.7 4.3 L-1.7 4.3 Z"/>
    </g>
  </g>
</svg>`;

export default class PlayerCard {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.dim = null;
        this.penguin = null;
        this._moviePromise = null;
        this._openSeq = 0;
        this._opening = false;
        // usa a instancia do scene — o handler de player-data/RENAME_FAILED
        // do RoomScene so conhece scene.nameChangeModal; uma instancia
        // separada aqui fazia o rename "nao funcionar" (modal nao fechava)
        this.nameChangeModal = scene.nameChangeModal || new NameChangeModal(scene);
    }

    // MovieRoom do interface pack — carregado lazy, uma vez por sessao.
    _movie() {
        if (!this._moviePromise) {
            this._moviePromise = MovieRoom.load('/assets/movies/interface')
                .then((m) => {
                    m.setScale(1);
                    // troca o glifo "?" do botao de rename pelo lapis —
                    // override e por-pack (compartilhado), vale p/ todos os cards
                    m.setSvgOverride?.('665.svg', PENCIL_SVG);
                    return m;
                })
                .catch((e) => { console.warn('[playercard] interface load', e); return null; });
        }
        return this._moviePromise;
    }

    get isOpen() { return !!this.container; }

    async open(penguin) {
        // card ja aberto/abrindo para o mesmo pinguim: clique extra nao faz
        // nada — sem isso cada clique fechava e reconstruia o card (e builds
        // concorrentes empilhavam containers orfaos na tela)
        const same = this.penguin && penguin &&
            (this.penguin === penguin || this.penguin.playerId === penguin.playerId);
        if (same && (this.isOpen || this._opening)) return;
        if (this.isOpen || this._opening) this.close();
        const token = ++this._openSeq;
        this._opening = true;
        this.penguin = penguin;
        try {
            const movie = await this._movie();
            if (!movie || !this.scene.sys.isActive() || token !== this._openSeq) return;
            await this._build(movie, penguin);
        } finally {
            if (token === this._openSeq) this._opening = false;
        }
    }

    close() {
        // invalida builds em andamento: um open() que ainda esta no await
        // aborta no check do token em vez de criar container orfao
        this._openSeq = (this._openSeq || 0) + 1;
        this._opening = false;
        // marca o instante do fechamento: o pointerdown que fechou o card
        // nao deve ser interpretado pelo RoomScene como clique de movimento
        // (senao o pinguim anda / reabre card se o clique pegou um pinguim)
        if (this.scene?.time) this.scene._pcardClosedAt = this.scene.time.now;
        // fecha o wardrobe junto (se estiver aberto)
        this.scene?.wardrobe?.close();
        if (this.dim) { this.dim.destroy(); this.dim = null; }
        if (this.container) { this.container.destroy(true); this.container = null; }
        this._tooltip?.hide();
        this._tooltip = null;
        this._cardBounds = null;
        this._drag = null;
        this._placeModBtn = null;
        this.scene?.input?.setDefaultCursor('default');
        // textura do card e por-abertura (playercard_<ts>) — sem remover,
        // cada open vazava uma CanvasTexture na GPU
        if (this._texKey && this.scene?.textures.exists(this._texKey)) {
            this.scene.textures.remove(this._texKey);
        }
        this._texKey = null;
        this._modBtnCleanup?.();
        this._modBtnCleanup = null;
        this._modBtn = null;
        this._clip = null;
        this.penguin = null;
    }

    // aplica os frames corretos dos botoes sociais conforme o estado
    // buddy/ignore — chamado no build e a cada SOCIAL_UPDATE
    _syncSocialFrames() {
        const clip = this._clip, p = this.penguin, scene = this.scene;
        if (!clip || !p || !scene?.network) return;
        const isSelf = p === scene.localPlayer
            || (scene.localPlayer && p.playerId === scene.localPlayer.playerId);
        if (isSelf) return;
        const isB = !!scene.network.isBuddy?.(p.playerId);
        const isI = !!scene.network.isIgnored?.(p.playerId);
        const online = isB && !!scene.remotePlayers?.has?.(p.playerId);
        clip.set('buddy_mc', { frame: isB ? 3 : isI ? 1 : 2 });
        clip.set('ignore_mc', { frame: isB ? 1 : isI ? 3 : 2 });
        clip.set('home_mc', { frame: isB ? 2 : 1 });
        clip.set('profile_mc', { frame: online ? 2 : 1 });
        this._repaint?.();
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

        // estados dos botoes sociais (so no card de outro pinguim) —
        // port do renderCard do gopenguin: buddy_mc frame 3=ja buddy
        // (remove), 1=ignored, 2=add normal; ignore_mc 1=buddy, 3=ignored,
        // 2=normal; home_mc 2=buddy, 1=cinza; profile_mc 2=buddy online
        this._clip = clip;
        if (!isSelf) this._syncSocialFrames();

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
        let dollWorld = null, bodyE = null, outlineE = null, feetB = null;
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
                        const fr = pm.data?.main?.frames?.[0] || [];
                        if (slot === 'feet') feetB = pclip._boundsOf(fr, dollWorld, '');
                        await pclip._drawListFrame(ctx, fr,
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
            // puffle equipado: variante "doll com pet" — sprite real do
            // puffle em pe a direita do boneco, pes na linha do chao
            const petDir = SPECIES_SPRITE[penguin.pet?.species];
            if (petDir && dollWorld && dollFrame) {
                const pm = await puffleMovie(petDir);
                if (pm) {
                    const pclip = new Clip(pm);
                    const entries = pm._mainTl?.frames?.[0] || [];
                    const pb = pclip._boundsOf(entries, IDENT, '');
                    const dollB = clip._boundsOf(dollFrame, dollWorld, '');
                    if (pb && dollB) {
                        const dollH = Math.max(1, dollB[3] - dollB[1]);
                        // clamp vertical tambem: o chao do doll pode ficar
                        // rente a borda inferior do card — o puffle subia
                        // alguns pixels para nao clipar
                        const ground = Math.min(
                            Math.max(dollB[3], feetB?.[3] ?? 0), b[3] - dollH * 0.05);
                        const right = Math.max(dollB[2], feetB?.[2] ?? 0);
                        const s = (dollH * 0.36) / Math.max(1, pb[3] - pb[1]);
                        const pW = (pb[2] - pb[0]) * s;
                        // a esquerda do puffle encosta na direita do doll com
                        // ~55% de sobreposicao — bem colado no pinguim como
                        // no original, sem transbordar a borda do card
                        let left = right + 2 - pW * 0.55;
                        // clamp: nunca sai dos bounds do card
                        left = Math.min(left, b[2] - 8 - pW);
                        left = Math.max(left, b[0] + 8);
                        const mat = {
                            a: s, b: 0, c: 0, d: s,
                            x: left - pb[0] * s,
                            y: ground - pb[3] * s,
                        };
                        await pclip._drawListFrame(ctx, entries, mat, '', IDENT_COLOR, RENDER_SCALE);
                    }
                }
            }
        };

        await paint(false);

        // ---- container ----
        const scale = Math.min(1, 480 / h); // cabe em ~480px de altura
        const dw = w * scale, dh = h * scale;
        this._cardSize = { dw, dh };
        // posicao: centro da tela + deslocamento escolhido pelo jogador
        // (arrastando), sempre dentro da area visivel
        const pos = this._clampTopLeft(WORLD_W / 2 + _cardOffset.x - dw / 2, WORLD_H / 2 + _cardOffset.y - dh / 2);
        const cont = scene.add.container(pos.x, pos.y).setDepth(20000000);
        this.container = cont;
        // métricas do card em coords de mundo — wardrobe se posiciona
        // à direita usando a borda real (getBounds é frágil: filhos com
        // coords absolutas dentro do container inflam o bounds)
        this._syncBounds();

        const texKey = `playercard_${Date.now()}`;
        this._texKey = texKey;
        scene.textures.addCanvas(texKey, canvas);
        // fundo do card = alca de arraste (botoes/boneco ficam por cima e
        // continuam recebendo o clique); tambem impede que clicar no fundo
        // do card caia no dim e feche tudo
        const bgImg = scene.add.image(0, 0, texKey).setOrigin(0, 0).setDisplaySize(dw, dh);
        cont.add(bgImg);
        this.makeDragHandle(bgImg);

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
            if (isSelf && action !== 'close' && action !== 'inventory' && action !== 'sort' && action !== 'next' && action !== 'back' && action !== 'rename') continue;
            // rename so existe no card proprio e enquanto canRename —
            // reaproveita o botao "?" (moderatorButtonEditPlayer) da arte
            if (action === 'rename' && (!isSelf || !scene.network?.canRename)) continue;
            const eb = clip._boundsOf([e], IDENT, '');
            if (!eb) continue;
            const [bx, by] = px((eb[0] + eb[2]) / 2, (eb[1] + eb[3]) / 2);
            const bw = (eb[2] - eb[0]) * scale, bh = (eb[3] - eb[1]) * scale;
            const zw = Math.max(bw, 22 * scale), zh = Math.max(bh, 22 * scale);
            const zone = scene.add.zone(bx, by, zw, zh)
                .setInteractive({ useHandCursor: true });
            zone.name = `pcard_${action}`;
            zone.on('pointerdown', () => this._button(action));
            // hint amarela original do CP (hint_mc) no hover do rename
            if (action === 'rename') {
                this._tooltip = this._tooltip || new UiTooltip(scene, cont);
                zone.on('pointerover', () =>
                    this._tooltip.show(bx - zw / 2, by - zh / 2, zw, zh, 'Rename penguin'));
                zone.on('pointerout', () => this._tooltip.hide());
            }
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
        // clique fora fecha — EXCETO em cima de um pinguim: trocar de alvo
        // (ou manter o mesmo) sem fechar, como no CP original
        this.dim = scene.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x000000, 0.45)
            .setOrigin(0.5).setDepth(19999999).setInteractive();
        this.dim.on('pointerdown', (p) => {
            const hit = this.scene._penguinAt?.(p.worldX, p.worldY);
            if (hit) { this.open(hit); return; }
            this.close();
        });

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

    // ---------- arrastar (card + inventario se movem juntos) ----------

    _clampTopLeft(x, y) {
        const { dw, dh } = this._cardSize || { dw: 0, dh: 0 };
        const m = 4; // margem ate a borda da tela
        return {
            x: Math.round(Math.max(m, Math.min(WORLD_W - dw - m, x))),
            y: Math.round(Math.max(m, Math.min(WORLD_H - dh - m, y))),
        };
    }

    _syncBounds() {
        const c = this.container;
        if (!c || !this._cardSize) return;
        const { dw, dh } = this._cardSize;
        this._cardBounds = { left: c.x, right: c.x + dw, top: c.y, bottom: c.y + dh };
    }

    // Torna `obj` (ja dentro do card ou do inventario) uma alca de arraste
    // do grupo. Usa a posicao do ponteiro em coords de mundo (o camera zoom
    // do supersampling ja esta descontado em pointer.worldX/Y).
    makeDragHandle(obj) {
        const scene = this.scene;
        if (!obj.input) obj.setInteractive();
        obj.input.cursor = 'grab';
        scene.input.setDraggable(obj);
        obj.on('dragstart', (p) => {
            if (!this.container) return;
            this._drag = { px: p.worldX, py: p.worldY, x: this.container.x, y: this.container.y };
            scene.input.setDefaultCursor('grabbing');
        });
        obj.on('drag', (p) => {
            const d = this._drag;
            if (!d || !this.container) return;
            const pos = this._clampTopLeft(d.x + p.worldX - d.px, d.y + p.worldY - d.py);
            this.container.setPosition(pos.x, pos.y);
            this._syncBounds();
            scene.wardrobe?.followCard?.();
            this._placeModBtn?.();
        });
        obj.on('dragend', () => {
            scene.input.setDefaultCursor('default');
            if (!this._drag || !this.container) { this._drag = null; return; }
            this._drag = null;
            const { dw, dh } = this._cardSize;
            _cardOffset = {
                x: Math.round(this.container.x + dw / 2 - WORLD_W / 2),
                y: Math.round(this.container.y + dh / 2 - WORLD_H / 2),
            };
            try { localStorage.setItem(CARD_POS_KEY, JSON.stringify(_cardOffset)); } catch { /* sem storage */ }
        });
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
            case 'buddy': {
                // add buddy por username (servidor resolve p/ playerId)
                const net = scene.network;
                const target = this.penguin;
                if (!net || !target || target === scene.localPlayer) break;
                // ignored (sem ser buddy): botao cinza sem acao — igual ao gp
                if (net.isIgnored?.(target.playerId) && !net.isBuddy?.(target.playerId)) break;
                if (net.isBuddy?.(target.playerId)) {
                    scene.localPlayer?.showChat?.(`(${target.username} is already your buddy)`);
                } else {
                    // confirmacao visual vem do server via BUDDY_REQUEST_SENT
                    // -> prompt_mc "Request Sent" (RoomScene)
                    net.buddyAdd(target.username);
                }
                break;
            }
            case 'ignore': {
                // toggle ignore — chat do jogador some para mim
                const net = scene.network;
                const target = this.penguin;
                if (!net || !target || target === scene.localPlayer) break;
                // buddy: botao cinza sem acao — igual ao gp (ignore_mc frame 1)
                if (net.isBuddy?.(target.playerId)) break;
                if (net.isIgnored?.(target.playerId)) {
                    net.ignoreRemove(target.playerId);
                    scene.localPlayer?.showChat?.(`(no longer ignoring ${target.username})`);
                } else {
                    net.ignoreAdd(target.playerId);
                    scene.localPlayer?.showChat?.(`(ignoring ${target.username} — their chat is hidden)`);
                }
                break;
            }
            case 'report':
            case 'home':
            case 'mail':
            case 'stamps':
                // acoes ainda sem backend — so feedback
                if (this.penguin) {
                    scene.localPlayer?.showChat?.(`(${action} on ${this.penguin.username} — coming soon)`);
                }
                break;
        }
    }
}
