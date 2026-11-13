// Visualizador de catalogos (livrinhos de roupa das salas) — port do
// player de catalogos do gopenguin (class xo em gp-index.js):
//   - paginas = frames da timeline principal ("book")
//   - botoes = buttonActions + onRelease dos frame actions, com bounds reais
//   - commands(): buyInventory/close/nextFrame/prevFrame/gotoAndStop/etc.
//   - paginas especiais: clothing f3 (tshirt customizer), sport f7 (segredos)
//   - texto dinamico: book.coinTotal.coins_txt = "YOUR COINS: N"
import { MovieRoom } from '../movie/movie.js';
import { PromptUI } from './Prompt.js';

const FRAME_RATE_MS = 1000 / 24;

// buyX(N) -> tipo de produto (port do Ri do gp)
const BUY_KINDS = {
    buyInventory: 'items', buyFurniture: 'furniture', buyIgloo: 'igloos',
    buyFloor: 'flooring', buyIglooFloor: 'flooring', upgradeIgloo: 'igloos',
    upgradeIglooFloor: 'flooring', buyIglooUpgrade: 'igloos',
};
const BUY_RE = /\b(buyInventory|buyFurniture|buyIgloo|buyFloor|buyIglooFloor|upgradeIgloo|upgradeIglooFloor|buyIglooUpgrade)\((\d+)(?:\)|,)/;

// Strings do shell original (data/shell-text.json do gopenguin)
const STR = {
    buy_inventory: 'Would you like to buy %name% for %cost% coins.',
    inventory_free: 'You have found a %name%.\nWould you like to pick it up?',
    low_coin_warn: 'You need more coins.',
    item_in_inventory_warn: 'You already have this item.',
    buy_inventory_done: '%name%\nhas been added to your inventory.',
    num_coins: 'You currently have %num% coins.',
    unavailable: 'This catalogue is currently unavailable.',
    not_available: 'This item is not available.',
};
const str = (k) => STR[k] || k;

let _itemsById = null;
async function itemsById() {
    if (!_itemsById) {
        const items = await fetch('/assets/items.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
        _itemsById = new Map(items.map((i) => [i.id, i]));
    }
    return _itemsById;
}

export class CatalogueOverlay {
    constructor(scene) {
        this.scene = scene;
        this.movie = null;
        this.key = null;
        this.page = 1;
        this.previousPage = 0;
        this.controls = [];
        this.hovered = null;
        this.img = null;
        this.canvas = null;
        this.texKey = null;
        this._timer = null;
        this._generation = 0;
        this._counts = new Map();      // secret.count por path
        // estado das paginas especiais (sport f7)
        this.sportPink = false;
        this.sportSecrets = new Set();
        // tshirt customizer (clothing f3)
        this.colour = 0;
        this.symbol = 0;
        this.itemArray = null;
        this._prompt = null;
        // cache de paginas renderizadas (sig -> canvas): virar de pagina
        // vira blit instantaneo em vez de re-renderizar ~1300 shapes
        this._pageCache = new Map();
        this._renderSs = 1.5;
        this._lastTickRender = 0;
    }

    get isOpen() { return !!this.movie; }
    get promptOpen() { return !!this._prompt?.isOpen; }

    async open(name, { page = 1 } = {}) {
        const key = name.replace(/_catalogue$/, '');
        this.close();
        const gen = ++this._generation;
        // modo carregando: tela de loading do jogo ate o movie+1a pagina prontos
        // (no CP original o catalog_viewer.swf mostrava animacao de load)
        this.scene.loadingScreen?.show('Loading catalogue...', 0);
        try {
            const movie = await MovieRoom.load(`/assets/catalogues/${key}`);
            if (this.movie || gen !== this._generation) return;
            this.movie = movie;
            movie.artFlatScale = true; // raster fixo em ss — warm cobre tudo
            this._pageCache = new Map(); // paginas do movie anterior nao valem
            this.key = key;
            this.page = 1;
            this.previousPage = 0;
            this.sportPink = false;
            this.sportSecrets.clear();
            this.colour = this.symbol = 0;
            this.itemArray = null;
            // decode dos SVGs do pack em chunks idle — sem isso cada shape
            // espera um decode serial durante o renderFrame (paginas brancas)
            movie.prefetchSvgs(16);
            await movie.ensureFonts();
            itemsById(); // prefetch do catalogo de itens (buy labels)
            const pages = movie.data?.main?.frames?.length || 1;
            movie.goto('book', Math.max(1, Math.min(pages, page)));
            this._buildCanvas();
            await this._show();
            this._startTick();
        } catch (e) {
            console.warn('[catalogue] falha ao abrir', key, e);
            this.scene._showRoomFail?.(key);
        } finally {
            if (gen === this._generation) this.scene.loadingScreen?.hide();
        }
    }

    _buildCanvas() {
        // UI fullscreen: cap de ss — render a 3x triplica pixels sem ganho
        // visivel (o gopenguin renderiza catalogo a 1x)
        const ss = this._renderSs = Math.min(this._renderSs || 2, 2);
        const cw = Math.round(760 * ss), ch = Math.round(480 * ss);
        this.canvas = document.createElement('canvas');
        this.canvas.width = cw; this.canvas.height = ch;
        // double buffer: renderFrame da clearRect no inicio — renderizar
        // direto no canvas visivel apagava a pagina por centenas de ms em
        // cada hover/tick/troca ("flash branco"). Renderiza no _back e so
        // copia para o visivel quando a pagina nova esta pronta.
        this._back = document.createElement('canvas');
        this._back.width = cw; this._back.height = ch;
        this.texKey = `catalogue_${this.key}`;
        if (this.scene.textures.exists(this.texKey)) this.scene.textures.remove(this.texKey);
        this._tex = this.scene.textures.addCanvas(this.texKey, this.canvas);
        this.img = this.scene.add.image(380, 240, this.texKey)
            .setDisplaySize(760, 480).setDepth(999999);
    }

    // ---------- render + controles (port do xo.render) ----------

    async _show() {
        const gen = this._generation;
        // estado 'over'/'down' do botao clicado nao pode vazar para o
        // snapshot cacheado da pagina — reseta antes de renderizar
        for (const [p, s] of this.movie._buttonStates)
            if (s !== 'up') this.movie.setButtonState(p, 'up');
        // warm da pagina alvo: dispara o decode de TODOS os SVGs dela em
        // paralelo — sem isso o renderFrame esperava um decode por vez
        // (catalogo clothing: ~30s na primeira visita de cada pagina)
        this.movie.prefetchFrames?.([this.movie.currentFrame('book')], 12, true, this._renderSs, false);
        await this._render(true); // troca de pagina: tenta cache primeiro
        if (gen !== this._generation) return;
        this._buildControls();
        // warm em background de TODAS as paginas restantes, em ordem —
        // o semaforo de raster drena ~6 por vez durante a leitura; sem
        // isso cada virada paga ~1-2s de createImageBitmap serial
        // (o renderFrame e sequencial: await por entry)
        const pg = this.movie.currentFrame('book');
        const len = this.movie.data?.main?.frames?.length || 1;
        const rest = [];
        for (let n = pg + 1; n <= len; n++) rest.push(n);
        const mv = this.movie;
        if (rest.length) setTimeout(() => {
            if (this.movie === mv) mv.prefetchFrames?.(rest, 12, true, this._renderSs, true);
        }, 300);
    }

    // assinatura do estado que afeta os pixels da pagina — coins_txt muda
    // raro (compra), paginas especiais (sport f7 / tshirt f3) tem estado
    // proprio; botao hover/roll NAO entra aqui (esses renders passam
    // useCache=false e nunca sujam o cache)
    _pageSig(page) {
        let s = `${page}|${this.scene.network?.coins ?? 0}`;
        if (this.key === 'clothing' && page === 3) s += `|c${this.colour}s${this.symbol}`;
        if (this.key === 'sport' && page === 7)
            s += `|p${this.sportPink ? 1 : 0}:${[...this.sportSecrets].sort().join(',')}`;
        return s;
    }

    async _render(useCache = false) {
        if (!this.movie || !this.canvas) return;
        // reentrancia: tick (5fps) e _show podem sobrepor renders de pagina
        // inteira — enfileira em vez de empilhar renderFrames concorrentes
        if (this._rendering) {
            this._renderQueued = true;
            this._renderQueuedCache = this._renderQueuedCache || useCache;
            return;
        }
        this._rendering = true;
        try {
            do {
                this._renderQueued = false;
                const uc = this._renderQueuedCache || useCache;
                this._renderQueuedCache = false;
                await this._renderInner(uc);
                useCache = false;
            } while (this._renderQueued);
        } finally { this._rendering = false; }
    }

    async _renderInner(useCache = false) {
        // coins_txt: "YOUR COINS: N" (editTexts -> texto dinamico com fonte TTF)
        const coins = this.scene.network?.coins ?? 0;
        this.movie.set('book.coinTotal.coins_txt', { text: `YOUR COINS: ${coins}` });
        const sig = useCache ? this._pageSig(this.movie.currentFrame('book')) : null;
        const hit = sig && this._pageCache.get(sig);
        if (hit) {
            const ctx = this.canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.drawImage(hit, 0, 0);
            this._tex?.refresh();
            return;
        }
        // double buffer: renderFrame no _back — o canvas visivel mantem a
        // pagina anterior ate a nova estar 100% pronta (sem flash branco)
        const back = this._back || this.canvas;
        await this.movie.renderFrame(undefined, back, this._renderSs || 2);
        if (this.canvas && back !== this.canvas) {
            const ctx = this.canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.drawImage(back, 0, 0);
        }
        this._tex?.refresh();
        if (sig) {
            const snap = document.createElement('canvas');
            snap.width = this.canvas.width; snap.height = this.canvas.height;
            snap.getContext('2d').drawImage(back, 0, 0);
            this._pageCache.set(sig, snap);
            while (this._pageCache.size > 10)
                this._pageCache.delete(this._pageCache.keys().next().value);
        }
    }

    _buildControls() {
        const m = this.movie;
        if (!m) { this.controls = []; return; }
        const page = m.currentFrame('book');
        this.page = page;
        // reset de estado ao trocar de pagina (port do xo: item/colour/symbol)
        if (this.previousPage !== page) {
            this.previousPage = page;
            this.colour = this.symbol = 0;
            this.itemArray = null;
            if (page === 7 && this.key === 'sport') {
                this.sportPink = false;
                this.sportSecrets.clear();
                for (const c of ['star.btn', 'star.active', 'shell.btn', 'shell.active',
                    'penguin.pink', 'penguin.silver', 'penguin.happy_face', 'silver_mc'])
                    m.set('book.' + c, { visible: false });
                m.set('book.penguin.fire', { visible: true });
                m.set('book.penguin.norm_face', { visible: true });
            }
        }

        const { entries, handlers } = m.collectInteractive();
        const controls = [];
        const norm = (p) => m._normalizePath(p);
        const baseIsBook = (base) => norm(base) === '';

        // handlers de frame actions (ex.: c0.onRelease dentro de main.actions)
        for (const h of handlers) {
            const w = this._commands(h.body, h.base);
            if (!w) continue;
            const target = norm(h.path);
            if (!m.find(target)) continue;
            const b = m.boundsFor(target);
            if (!b) continue;
            const last = target.split('.').pop();
            const label = last === 'left_turn' ? 'Previous page'
                : (last === 'right_turn' || last === 'cover_mc') ? 'Next page'
                : 'Catalogue detail';
            controls.push({ path: target, bounds: b, label, action: w, base: h.base });
        }

        for (const e of entries) {
            const d = e.base;             // path do timeline pai ('' = book/main)
            const acts = e.acts || {};
            let w = acts.release ? this._commands(acts.release, d) : null;
            let label = '';
            const buyM = acts.release && BUY_RE.exec(acts.release);
            if (buyM) {
                label = `Buy item ${buyM[2]}`;
            } else if (acts.release?.includes('adoptPuffle')) {
                label = 'Adopt puffle';
            } else if (acts.release?.includes('nextFrame()')) {
                label = baseIsBook(d) ? 'Next page' : 'Reveal secret';
            } else if (acts.release?.includes('prevFrame()')) {
                label = 'Previous page';
            } else if (acts.release && /(?:close|closeContent)\(\)/.test(acts.release)) {
                label = 'Close catalogue';
            } else {
                label = 'Catalogue detail';
            }
            if (buyM) {
                const item = _itemsById?.get(Number(buyM[2]));
                if (item) label = `Buy ${item.name} for ${item.cost} coins`;
            }

            // ---- paginas especiais (port do xo.render) ----
            if (this.key === 'clothing' && baseIsBook(d) && page === 3) {
                const nm = e.name || '';
                if (/^c[0-4]$/.test(nm)) {
                    const T = Number(nm[1]);
                    label = `T-shirt colour ${T + 1}`;
                    w = () => { this.colour = T; this.movie.goto('book.tshirtbuilt', this.colour * 5 + this.symbol + 1); this._show(); };
                } else if (/^s[0-4]$/.test(nm)) {
                    const T = Number(nm[1]);
                    label = `T-shirt design ${T + 1}`;
                    w = () => { this.symbol = T; this.movie.goto('book.tshirtbuilt', this.colour * 5 + this.symbol + 1); this._show(); };
                } else if (nm === 'tshirtbuy_btn') {
                    label = 'Buy custom T-shirt';
                    w = () => {
                        const arr = this._tshirtItemArray();
                        const id = arr?.[this.colour]?.[this.symbol];
                        if (id) this._buy('items', id);
                    };
                }
            }
            if (this.key === 'sport' && baseIsBook(d) && page === 7) {
                const nm = e.name || '';
                if (nm === 'penguin') {
                    label = 'Change surfboard';
                    w = () => {
                        this.sportPink = !this.sportPink;
                        this.sportSecrets.clear();
                        for (const T of ['penguin.pink', 'star.btn', 'shell.btn'])
                            this.movie.set('book.' + T, { visible: this.sportPink });
                        this.movie.set('book.penguin.fire', { visible: !this.sportPink });
                        this.movie.set('book.penguin.norm_face', { visible: true });
                        for (const T of ['penguin.silver', 'penguin.happy_face', 'silver_mc', 'star.active', 'shell.active'])
                            this.movie.set('book.' + T, { visible: false });
                        this._show();
                    };
                } else if ((norm(d) === 'star' || norm(d) === 'shell') && nm === 'btn') {
                    // book.star.btn / book.shell.btn — segredos da prancha
                    const node = norm(d);
                    label = 'Reveal surfboard secret';
                    w = () => {
                        if (this.sportSecrets.has(node)) this.sportSecrets.delete(node);
                        else this.sportSecrets.add(node);
                        this.movie.set(`book.${node}.active`, { visible: this.sportSecrets.has(node) });
                        if (this.sportSecrets.size === 2) {
                            for (const T of ['penguin.silver', 'silver_mc', 'penguin.happy_face'])
                                this.movie.set('book.' + T, { visible: true });
                            for (const T of ['penguin.pink', 'penguin.fire', 'penguin.norm_face'])
                                this.movie.set('book.' + T, { visible: false });
                        }
                        this._show();
                    };
                }
            }
            if (!w) continue;
            controls.push({
                path: e.path, bounds: e.bounds, label, action: w,
                release: acts.release, rollOver: acts.rollOver,
                rollOut: acts.rollOut, base: d,
                _itemId: buyM ? Number(buyM[2]) : undefined,
                _buyKind: buyM ? BUY_KINDS[buyM[1]] : undefined,
            });
        }
        this.controls = controls;
        this.hovered = null;
    }

    // itemArray da pagina de tshirt customizer (main.actions[3].source)
    _tshirtItemArray() {
        if (this.itemArray) return this.itemArray;
        const src = this.movie._mainTl.actions?.['3']?.source
            || this.movie._mainTl.actions?.[3]?.source || '';
        const arr = [];
        for (const m of src.matchAll(/itemArray\[(\d+)\]\s*=\s*\[([\d,\s]+)\]/g))
            arr[Number(m[1])] = m[2].split(',').map((s) => Number(s.trim())).filter(Boolean);
        this.itemArray = arr.length ? arr : null;
        return this.itemArray;
    }

    // produto do catalogo (items.json completo — Ht("items") do gp)
    async _product(kind, id) {
        if (kind !== 'items') return null;
        return (await itemsById()).get(id) || null;
    }

    // ---------- commands(): interpreta o corpo do on(release) ----------
    // Port direto do xo.commands — retorna funcao ou null.
    _commands(body, basePath, movie = this.movie, show = true) {
        const adopt = /adoptPuffle\((\d+)\)/.exec(body);
        if (adopt) return () => this._notice('Puffle adoption is not available yet.');
        const buy = BUY_RE.exec(body);
        if (buy) {
            const kind = BUY_KINDS[buy[1]];
            const id = Number(buy[2]);
            return () => this._buy(kind, id);
        }
        if (/(?:close|closeContent)\(\)/.test(body)) return () => this.close();
        if (body.includes('secret.count == 3')) {
            return () => {
                const r = basePath + '.secret';
                const l = (this._counts.get(r) ?? 0) + 1;
                this._counts.set(r, l);
                this.movie.goto(r, l % 3 === 0 ? 3 : 2);
                if (show) this._show();
            };
        }
        if (/\b(if|for|while)\s*\(/.test(body)) return null;
        const ops = [...body.matchAll(/([\w.]*?)(nextFrame|prevFrame|gotoAndStop|gotoAndPlay)\(\s*(?:(\d+)|"([^"]+)")?\s*\)/g)];
        if (ops.length) {
            return () => {
                for (const [, r, l, c, d] of ops) {
                    const f = this._target(basePath, r);
                    const u = movie.find(f);
                    if (!u) continue;
                    const m = movie.data.sprites?.[u.id];
                    if (!m && !u.main) continue;
                    const cur = movie.currentFrame(f);
                    const g = l === 'nextFrame' ? cur + 1
                        : l === 'prevFrame' ? cur - 1
                        : c ? Number(c) : d;
                    if (g !== undefined) movie.goto(f, g);
                }
                if (show) this._show();
            };
        }
        return null;
    }

    // target(): resolve path relativo (_parent/this/..) — port do xo.target
    _target(e, t) {
        let s = e;
        for (const i of String(t).split('.').filter(Boolean)) {
            if (i === '_parent') s = s.replace(/(?:\.[^.#]+|#\d+)$/, '');
            else if (i !== 'this') s += '.' + i;
        }
        return s;
    }

    // ---------- interacao ----------

    buttonAt(x, y) {
        for (let i = this.controls.length - 1; i >= 0; i--) {
            const b = this.controls[i];
            const [x0, y0, x1, y1] = b.bounds;
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return b;
        }
        return null;
    }

    hoverAt(x, y) {
        if (!this.movie) return;
        const b = this.buttonAt(x, y);
        const path = b ? b.path : null;
        if (path === this.hovered) return;
        if (this.hovered) {
            const old = this.controls.find((o) => o.path === this.hovered);
            this.movie.setButtonState(this.hovered, 'up');
            if (old?.rollOver) this._runRoll(old.rollOut, old.base);
        }
        if (b) {
            this.movie.setButtonState(b.path, 'over');
            if (b.rollOver) this._runRoll(b.rollOver, b.base);
            this._render();
            // hover-intent: se o cursor esta na seta de pagina, ja aquece
            // a pagina adjacente — o clique seguinte sai quase instantaneo
            if (b.label === 'Next page' || b.label === 'Previous page') {
                const pg = this.movie.currentFrame('book');
                const len = this.movie.data?.main?.frames?.length || 1;
                const nxt = b.label === 'Next page' ? pg + 1 : pg - 1;
                if (nxt >= 1 && nxt <= len) {
                    const mv = this.movie;
                    setTimeout(() => {
                        if (this.movie === mv) mv.prefetchFrames?.([nxt], 12, true, this._renderSs, true);
                    }, 120);
                }
            }
        }
        this.hovered = path;
    }

    // rollOver/rollOut: ex. "on(rollOver){ penguin.gotoAndStop(N) }" = preview
    _runRoll(src, base) {
        if (!src) return;
        const fn = this._commands(src, base ?? '', this.movie, false);
        if (fn) fn();
    }

    clickAt(x, y) {
        const b = this.buttonAt(x, y);
        if (!b) return false;
        if (b.action) b.action();
        return true;
    }

    // ---------- compra (port do INTERFACE.buyInventory do gp) ----------

    async _buy(kind, id) {
        const net = this.scene.network;
        if (kind !== 'items') return this._notice(str('unavailable'));
        const item = await this._product(kind, id);
        if (!item) return this._notice(str('not_available'));
        const owned = net?.hasItem?.(id);
        if (owned) return this._notice(str('item_in_inventory_warn'));
        const coins = net?.coins ?? 0;
        if ((item.cost || 0) > 0 && coins < item.cost)
            return this._notice(str('low_coin_warn'));
        const msg = (item.cost || 0) === 0
            ? str('inventory_free').replace('%name%', item.name)
            : str('buy_inventory').replace('%name%', item.name).replace('%cost%', item.cost)
              + ' ' + str('num_coins').replace('%num%', String(coins));
        this._confirm(msg, async () => {
            // Compra sempre passa pelo servidor (BUY_ITEM -> inventario no
            // banco) — sem isso o EQUIP_ITEM falha com "nao possui este item".
            // A simulacao local so existe como fallback offline (sem WS).
            if (net?.isConnected && net.buyItemAsync) {
                const res = await net.buyItemAsync(id);
                if (res.ok) {
                    this._notice(str('buy_inventory_done').replace('%name%', item.name));
                    this._show();
                } else {
                    const map = {
                        INSUFFICIENT_COINS: str('low_coin_warn'),
                        ALREADY_OWNED: str('item_in_inventory_warn'),
                        UNKNOWN_ITEM: str('not_available'),
                    };
                    this._notice(map[res.code] || res.error || 'Purchase failed.');
                }
            } else {
                // offline (sem WS): simulacao local para teste
                if (net?.inventory && !net.inventory.some((i) => i.itemId === id))
                    net.inventory.push({ itemId: id, quantity: 1 });
                if (net) net.coins = Math.max(0, (net.coins || 0) - (item.cost || 0));
                this._notice(str('buy_inventory_done').replace('%name%', item.name));
                this._show();
            }
        });
    }

    // ---------- dialogs (interface_mc.prompt_mc do interface.swf — o mesmo
    // prompt_mc que o gp usa em INTERFACE.notice: frame 2 Yes/No, frame 4 Okay)

    _notice(msg, onClose) { this._confirm(msg, onClose, false); }

    _confirm(msg, onYes, yesNo = true) {
        // substitui o painel desenhado a mao pelo prompt_mc autenticado
        if (!this._prompt) this._prompt = new PromptUI(this.scene);
        this._prompt.show({
            text: msg,
            mode: yesNo ? 'yesno' : 'ok',
            onYes: () => onYes?.(),
            onNo: () => {},
        }).catch((e) => console.warn('[prompt]', e));
    }

    close() {
        this._generation++;
        this._prompt?.close();
        this._stopTick();
        if (this.img) { this.img.destroy(); this.img = null; }
        if (this.texKey && this.scene.textures.exists(this.texKey)) this.scene.textures.remove(this.texKey);
        this.canvas = null; this._back = null; this.movie = null; this.controls = []; this.hovered = null;
        this._tex = null;
    }

    _startTick() {
        this._stopTick();
        this._timer = this.scene.time.addEvent({
            delay: FRAME_RATE_MS, loop: true,
            callback: () => {
                if (!this.movie) return;
                this.movie.tick();
                // throttle: uma pagina animada re-renderizava inteira a
                // 24fps — agora no max ~5 renders/s e so quando sujo
                const dirty = this.movie._dirty || this.movie._dirtyRoots?.size;
                const now = this.scene.time.now;
                if (dirty && now - this._lastTickRender > 200) {
                    this._lastTickRender = now;
                    this._render();
                }
            },
        });
    }

    _stopTick() {
        if (this._timer) { this._timer.remove(); this._timer = null; }
    }
}
