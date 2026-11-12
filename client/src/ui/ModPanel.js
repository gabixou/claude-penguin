// ModPanel.js — painel de moderação (DOM overlay).
// Abre a partir do player card quando o jogador local é mod/admin
// e está vendo o card de outro jogador.

const CSS = `
.cp-mod{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:95000;background:#1d2733;color:#eef2f7;font-family:Arial,sans-serif;border:1px solid #3a4a5e;border-radius:12px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.5);min-width:240px;}
.cp-mod h3{margin:0 0 8px;font-size:13px;color:#7db4ff;}
.cp-mod .who{font-size:12px;color:#9fb2c8;margin-bottom:8px;}
.cp-mod .row{display:flex;flex-wrap:wrap;gap:6px;}
.cp-mod button{padding:6px 10px;font-size:11px;font-weight:700;border:none;border-radius:7px;cursor:pointer;color:#fff;}
.cp-mod button:disabled{opacity:.4;cursor:default;}
.cp-mod .kick{background:#b3541e;} .cp-mod .mute{background:#8a6d1d;}
.cp-mod .warn{background:#4a5f7a;} .cp-mod .ban{background:#a02c2c;}
.cp-mod .unban{background:#2c6e49;} .cp-mod .role{background:#5b3d8a;}
.cp-mod .close{background:#3a4a5e;margin-left:auto;}
.cp-mod input,.cp-mod select{width:100%;box-sizing:border-box;margin:6px 0;padding:6px 8px;font-size:12px;border-radius:6px;border:1px solid #3a4a5e;background:#121a24;color:#eef2f7;}
.cp-mod .msg{font-size:11px;color:#8fd0a0;min-height:14px;margin-top:6px;}
`;

export default class ModPanel {
    constructor(scene) {
        this.scene = scene;
        this.el = null;
        this.target = null;
    }

    get isOpen() { return !!this.el; }

    open(targetPenguin) {
        this.close();
        if (typeof document === 'undefined' || !targetPenguin?.playerId) return;
        this.target = targetPenguin;
        const me = this.scene.network?.role;
        const isAdmin = me === 'admin';

        if (!document.getElementById('cp-mod-css')) {
            const s = document.createElement('style');
            s.id = 'cp-mod-css';
            s.textContent = CSS;
            document.head.appendChild(s);
        }

        const el = document.createElement('div');
        el.className = 'cp-mod';
        const h = document.createElement('h3');
        h.textContent = 'Moderação';
        const who = document.createElement('div');
        who.className = 'who';
        who.textContent = targetPenguin.username || targetPenguin.playerId;
        el.appendChild(h); el.appendChild(who);

        const reason = document.createElement('input');
        reason.placeholder = 'Motivo (opcional)';
        el.appendChild(reason);

        const mins = document.createElement('input');
        mins.placeholder = 'Duração em minutos (vazio = permanente p/ ban)';
        mins.type = 'number'; mins.min = '1';
        el.appendChild(mins);

        const row = document.createElement('div');
        row.className = 'row';
        const mk = (label, cls, action, opts = {}) => {
            const b = document.createElement('button');
            b.className = cls;
            b.textContent = label;
            b.onclick = () => this._act(action, opts);
            row.appendChild(b);
            return b;
        };
        mk('Expulsar', 'kick', 'mod.kick');
        mk('Silenciar', 'mute', 'mod.mute');
        mk('Avisar', 'warn', 'mod.warn');
        mk('Banir', 'ban', 'mod.ban');
        mk('Desbanir', 'unban', 'mod.unban');
        if (isAdmin) {
            const sel = document.createElement('select');
            sel.innerHTML = '<option value="player">player</option><option value="moderator">moderator</option><option value="admin">admin</option>';
            sel.style.width = 'auto';
            const rb = document.createElement('button');
            rb.className = 'role'; rb.textContent = 'Definir papel';
            rb.onclick = () => this._act('mod.set_role', { newRole: sel.value });
            row.appendChild(sel); row.appendChild(rb);
        }
        const x = document.createElement('button');
        x.className = 'close'; x.textContent = '✕';
        x.onclick = () => this.close();
        row.appendChild(x);
        el.appendChild(row);

        this.msgEl = document.createElement('div');
        this.msgEl.className = 'msg';
        el.appendChild(this.msgEl);

        this._reason = reason;
        this._mins = mins;
        document.body.appendChild(el);
        this.el = el;
    }

    _act(action, opts = {}) {
        const net = this.scene.network;
        if (!net || !this.target) return;
        const reason = this._reason?.value || null;
        const minutes = this._mins?.value ? Number(this._mins.value) : null;
        net.sendModAction(action, this.target.playerId, { reason, minutes, ...opts });
        if (this.msgEl) this.msgEl.textContent = 'Enviando...';
    }

    onModOk(data) {
        if (this.msgEl) this.msgEl.textContent = `${data.action} aplicado em ${data.username || ''}`;
        setTimeout(() => this.close(), 1200);
    }

    close() {
        this.el?.remove();
        this.el = null;
        this.target = null;
    }
}
