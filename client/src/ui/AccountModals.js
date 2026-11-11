// AccountModals.js — modais de conta:
//  - RecoveryCodeModal: mostra o código de recuperação UMA vez + botão .txt
//  - SetPasswordModal: fluxo de migração "defina sua senha" (contas sem senha)

const CSS = `
.cp-acct{position:fixed;inset:0;z-index:90001;display:flex;align-items:center;justify-content:center;background:rgba(10,20,40,.72);font-family:Arial,Helvetica,sans-serif;}
.cp-acct .box{width:360px;max-width:92vw;background:#f8f8f8;border:3px solid #0072ce;border-radius:14px;padding:22px 24px;box-shadow:0 12px 40px rgba(0,0,0,.45);text-align:center;}
.cp-acct h2{margin:0 0 8px;font-size:17px;color:#0072ce;}
.cp-acct p{margin:6px 0;font-size:12px;color:#555;line-height:1.5;}
.cp-acct .code{font:700 20px/1.4 'Courier New',monospace;letter-spacing:2px;color:#222;background:#fff;border:2px dashed #0072ce;border-radius:10px;padding:12px;margin:12px 0;user-select:all;}
.cp-acct .label{font-size:11px;color:#888;margin-bottom:12px;}
.cp-acct button{padding:9px 18px;font-size:13px;font-weight:700;color:#fff;background:#0072ce;border:none;border-radius:8px;cursor:pointer;margin:4px;}
.cp-acct button.ghost{background:#e8eef5;color:#0072ce;border:1px solid #b9c6d8;}
.cp-acct button:hover{filter:brightness(1.08);}
.cp-acct input{width:100%;box-sizing:border-box;padding:9px 10px;font-size:14px;border:2px solid #9db8d2;border-radius:8px;outline:none;margin:4px 0;}
.cp-acct .err{min-height:16px;font-size:11px;color:#c0392b;margin-top:6px;}
.cp-acct .warn{font-size:11px;color:#a05a00;background:#fff3d6;border:1px solid #e8c97a;border-radius:8px;padding:8px;margin:10px 0;}
`;

function ensureStyle() {
    if (typeof document === 'undefined' || document.getElementById('cp-acct-css')) return;
    const style = document.createElement('style');
    style.id = 'cp-acct-css';
    style.textContent = CSS;
    document.head.appendChild(style);
}

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}

function overlay(box) {
    const wrap = el('div', 'cp-acct');
    wrap.appendChild(box);
    document.body.appendChild(wrap);
    return wrap;
}

// ---------- Recovery code (mostrado uma única vez) ----------

export class RecoveryCodeModal {
    constructor() { this.el = null; }
    get isOpen() { return !!this.el; }

    open({ recoveryCode, recoveryLabel }, onClose = null) {
        this.close();
        this._onClose = onClose;
        ensureStyle();
        const box = el('div', 'box');
        box.appendChild(el('h2', null, 'Código de recuperação'));
        box.appendChild(el('p', null, 'Anote este código — ele é exibido apenas uma vez e serve para recuperar sua conta.'));
        box.appendChild(el('div', 'code', recoveryCode));
        box.appendChild(el('div', 'label', `Rótulo: ${recoveryLabel}`));
        box.appendChild(el('p', null, 'Recomendado: baixe o arquivo .txt e guarde em local seguro.'));

        const dl = el('button', null, 'Baixar .txt');
        dl.onclick = () => {
            const blob = new Blob(
                [`Claude Penguin - Código de recuperação\n\nRótulo: ${recoveryLabel}\nCódigo: ${recoveryCode}\n\nGuarde este código em local seguro. Ele permite redefinir sua senha.\n`],
                { type: 'text/plain' }
            );
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'claude-penguin-recovery.txt';
            a.click();
            URL.revokeObjectURL(a.href);
        };
        const ok = el('button', 'ghost', 'Entendi, guardei');
        ok.onclick = () => this.close();
        box.appendChild(dl);
        box.appendChild(ok);

        this.el = overlay(box);
    }

    close() {
        this.el?.remove();
        this.el = null;
        const cb = this._onClose;
        this._onClose = null;
        cb?.();
    }
}

// ---------- Definir senha (migração de contas antigas) ----------

export class SetPasswordModal {
    constructor(scene) {
        this.scene = scene;
        this.el = null;
        this._t = null;
    }
    get isOpen() { return !!this.el; }

    open() {
        if (this.isOpen) return;
        ensureStyle();
        const box = el('div', 'box');
        box.appendChild(el('h2', null, 'Defina uma senha'));
        box.appendChild(el('p', null, 'Sua conta ainda não tem senha. Crie uma para poder entrar de qualquer lugar — seus itens e progresso continuam os mesmos.'));
        box.appendChild(el('div', 'warn', 'Depois de definir, você recebe um código de recuperação (mostrado uma única vez).'));

        const p1 = document.createElement('input');
        p1.type = 'password'; p1.placeholder = 'Nova senha (6+ caracteres)'; p1.autocomplete = 'new-password';
        const p2 = document.createElement('input');
        p2.type = 'password'; p2.placeholder = 'Confirmar senha'; p2.autocomplete = 'new-password';
        const err = el('div', 'err');
        box.appendChild(p1); box.appendChild(p2); box.appendChild(err);

        const save = el('button', null, 'Definir senha');
        const skip = el('button', 'ghost', 'Agora não');
        const row = el('div'); row.style.marginTop = '10px';
        row.appendChild(save); row.appendChild(skip);
        box.appendChild(row);

        const submit = () => {
            err.textContent = '';
            if (p1.value.length < 6) { err.textContent = 'Senha muito curta (mín. 6)'; return; }
            if (p1.value !== p2.value) { err.textContent = 'As senhas não conferem'; return; }
            save.disabled = true; save.textContent = 'Salvando...';
            this.scene.network?.setPassword?.(p1.value);
            clearTimeout(this._t);
            this._t = setTimeout(() => { save.disabled = false; save.textContent = 'Definir senha'; }, 10000);
        };
        save.onclick = submit;
        p2.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        skip.onclick = () => this.close();

        this.el = overlay(box);
        p1.focus();
    }

    onServerResponse(success, message = '') {
        clearTimeout(this._t);
        if (success) { this.close(); return true; }
        const err = this.el?.querySelector('.err');
        if (err) err.textContent = message || 'Falha ao definir senha';
        const btn = this.el?.querySelector('button');
        if (btn) { btn.disabled = false; btn.textContent = 'Definir senha'; }
        return false;
    }

    close() { this.el?.remove(); this.el = null; }
}
