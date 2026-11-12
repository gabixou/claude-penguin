// ModMenu.js — menu DOM de ações de moderação (kick/mute/warn/ban/unban).
// Abre sobre o player card quando o jogador local é moderador/admin.

const CSS = `
.cp-mod{position:fixed;z-index:90002;font-family:Arial,sans-serif;}
.cp-mod .btns{display:flex;flex-direction:column;gap:4px;background:#1d2b45;border:2px solid #4a6fa5;border-radius:10px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);}
.cp-mod button{padding:7px 14px;font-size:12px;font-weight:700;color:#fff;background:#2e4a75;border:1px solid #4a6fa5;border-radius:7px;cursor:pointer;text-align:left;white-space:nowrap;}
.cp-mod button:hover{background:#3d5f96;}
.cp-mod button.danger{background:#7a2e2e;border-color:#a54a4a;}
.cp-mod button.danger:hover{background:#9a3a3a;}
.cp-mod .reason{margin-top:6px;}
.cp-mod input{width:100%;box-sizing:border-box;padding:6px 8px;font-size:12px;border:1px solid #4a6fa5;border-radius:6px;background:#0f1830;color:#fff;outline:none;}
.cp-mod .row{display:flex;gap:4px;margin-top:6px;}
.cp-mod .row button{flex:1;text-align:center;padding:6px;}
`;

let _styleDone = false;
function ensureStyle() {
    if (typeof document === 'undefined' || _styleDone) return;
    _styleDone = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
}

const ACTIONS = [
    { id: 'mod.kick', label: 'Expulsar', danger: true },
    { id: 'mod.mute', label: 'Silenciar 10 min', prompt: 'Motivo (opcional):' },
    { id: 'mod.warn', label: 'Advertir', prompt: 'Motivo:' },
    { id: 'mod.ban', label: 'Banir', danger: true, prompt: 'Motivo + minutos (ex.: spam 60):' },
    { id: 'mod.unban', label: 'Desbanir' },
];

export default class ModMenu {
    constructor(scene) {
        this.scene = scene;
        this.el = null;
        this.target = null;
    }

    get isOpen() { return !!this.el; }

    // Abre ao lado do player card; target = {playerId, username}
    open(target, x, y) {
        this.close();
        ensureStyle();
        this.target = target;
        this.el = document.createElement('div');
        this.el.className = 'cp-mod';
        this.el.style.left = `${Math.min(x + 8, window.innerWidth - 190)}px`;
        this.el.style.top = `${Math.min(y, window.innerHeight - 260)}px`;

        const box = document.createElement('div');
        box.className = 'btns';
        this.el.appendChild(box);

        for (const a of ACTIONS) {
            const b = document.createElement('button');
            b.textContent = a.label;
            if (a.danger) b.className = 'danger';
            b.onclick = () => this._act(a);
            box.appendChild(b);
        }

        document.body.appendChild(this.el);
        // fecha ao clicar fora
        setTimeout(() => {
            const off = (e) => { if (!this.el?.contains(e.target)) { document.removeEventListener('pointerdown', off, true); this.close(); } };
            document.addEventListener('pointerdown', off, true);
        }, 0);
    }

    _act(a) {
        if (a.prompt !== undefined && a.id !== 'mod.unban' && a.id !== 'mod.kick') {
            this._promptReason(a);
            return;
        }
        this._send(a.id, null, null);
    }

    _promptReason(a) {
        const box = this.el.querySelector('.btns');
        box.querySelectorAll('button').forEach((b) => b.disabled = true);
        const wrap = document.createElement('div');
        wrap.className = 'reason';
        const input = document.createElement('input');
        input.placeholder = a.prompt || 'Motivo:';
        const row = document.createElement('div');
        row.className = 'row';
        const ok = document.createElement('button');
        ok.textContent = 'OK';
        const cancel = document.createElement('button');
        cancel.textContent = 'Voltar';
        cancel.className = 'ghost';
        row.appendChild(ok); row.appendChild(cancel);
        wrap.appendChild(input); wrap.appendChild(row);
        box.appendChild(wrap);
        ok.onclick = () => {
            const raw = input.value.trim();
            let reason = raw, minutes = null;
            // convenção para ban: "motivo minutos" — pega último número
            if (a.id === 'mod.ban') {
                const m = raw.match(/^(.*?)\s+(\d+)\s*$/);
                if (m) { reason = m[1] || 'Banido'; minutes = Number(m[2]); }
            } else if (a.id === 'mod.mute') {
                minutes = 10;
            }
            this._send(a.id, reason || null, minutes);
        };
        cancel.onclick = () => { wrap.remove(); box.querySelectorAll('button').forEach((b) => b.disabled = false); };
        input.focus();
    }

    _send(action, reason, minutes) {
        this.scene.network?.sendModAction?.(action, this.target?.playerId, { reason, minutes });
        this.close();
    }

    close() {
        this.el?.remove();
        this.el = null;
        this.target = null;
    }
}
