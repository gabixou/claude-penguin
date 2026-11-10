// Overlay de minigames — roda o jogo vendored em public/minigames/<id>/
// dentro de um iframe DOM escalado para caber na viewport (resolucao nativa
// do jogo preservada via transform: scale). Isola totalmente o bundle Phaser
// do cliente principal (o minigame usa Phaser 3.50 + Matter proprio).

const MINIGAMES = {
    // porta direita do Pet Shop (triggers_mc.roundup_mc -> sendJoinGame)
    roundup: 'pufflescape',
    pufflescape: 'pufflescape',
};

export class MinigameOverlay {
    constructor(scene) {
        this.scene = scene;
        this.el = null;
        this.frame = null;
        this._onResize = () => this._fit();
    }

    static urlFor(game) {
        const id = MINIGAMES[game];
        return id ? `/minigames/${id}/index.html` : null;
    }

    get isOpen() { return !!this.el; }

    open(game) {
        const url = MinigameOverlay.urlFor(game);
        if (!url) return false;
        this.close();

        const W = 1520, H = 960;
        this.el = document.createElement('div');
        this.el.style.cssText =
            'position:fixed; inset:0; z-index:10000; background:#242424;' +
            'display:flex; align-items:center; justify-content:center;';

        this.frame = document.createElement('div');
        this.frame.style.cssText = `position:relative; width:${W}px; height:${H}px;`;

        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.cssText =
            `width:${W}px; height:${H}px; border:0; display:block;` +
            'background:#242424;';
        iframe.setAttribute('allow', 'autoplay');
        this.frame.appendChild(iframe);

        this.el.appendChild(this.frame);
        document.body.appendChild(this.el);

        window.addEventListener('resize', this._onResize);
        this._onMessage = (e) => this._handleMessage(e);
        window.addEventListener('message', this._onMessage);
        this._fit();
        return true;
    }

    // Mensagens do iframe do minigame (ex.: level completo -> reward de coins)
    _handleMessage(e) {
        if (!this.el || !this.frame) return;
        const iframe = this.frame.querySelector('iframe');
        if (!iframe || e.source !== iframe.contentWindow) return;
        const d = e.data;
        if (!d || d.source !== 'pufflescape') return;
        if (d.type === 'exit') {
            // botao X original do jogo — volta para a sala (retoma musica etc.)
            this.scene._closeMinigame?.();
            return;
        }
        if (d.type === 'level-complete') {
            this.scene.network?.send('MINIGAME_REWARD', { level: d.level || 1 });
            this._toast(`Level ${d.level || 1} complete! +50 coins`);
        }
    }

    _toast(text) {
        const t = document.createElement('div');
        t.textContent = text;
        t.style.cssText =
            'position:fixed; top:16px; left:50%; transform:translateX(-50%);' +
            'z-index:10001; background:rgba(20,30,50,.9); color:#ffd75e;' +
            'font:bold 15px Arial,sans-serif; padding:8px 18px; border-radius:20px;' +
            'border:1px solid rgba(255,215,94,.5); pointer-events:none;';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3200);
    }

    _fit() {
        if (!this.frame) return;
        const W = 1520, H = 960;
        const s = Math.min(window.innerWidth / W, window.innerHeight / H);
        this.frame.style.transform = `scale(${s})`;
        this.frame.style.transformOrigin = 'center center';
    }

    close() {
        window.removeEventListener('resize', this._onResize);
        if (this._onMessage) window.removeEventListener('message', this._onMessage);
        this._onMessage = null;
        this.el?.remove();
        this.el = null;
        this.frame = null;
    }
}
