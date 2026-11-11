// AuthModal.js — telas de login / cadastro / recuperação (DOM overlay).
// Abre quando o servidor responde NEED_AUTH (sem sessão válida).
// Fale com o servidor via NetworkClient (register/login/recover/guest).

const CSS = `
.cp-auth{position:fixed;inset:0;z-index:90000;display:flex;align-items:center;justify-content:center;background:rgba(10,20,40,.72);font-family:Arial,Helvetica,sans-serif;}
.cp-auth .box{width:340px;max-width:92vw;background:#f8f8f8;border:3px solid #0072ce;border-radius:14px;padding:22px 24px 20px;box-shadow:0 12px 40px rgba(0,0,0,.45);}
.cp-auth h1{margin:0 0 2px;font-size:20px;color:#0072ce;text-align:center;letter-spacing:.5px;}
.cp-auth .sub{margin:0 0 14px;font-size:11px;color:#777;text-align:center;}
.cp-auth .tabs{display:flex;gap:6px;margin-bottom:14px;}
.cp-auth .tabs button{flex:1;padding:7px 4px;font-size:12px;font-weight:700;color:#555;background:#e8eef5;border:1px solid #b9c6d8;border-radius:8px;cursor:pointer;}
.cp-auth .tabs button.on{background:#0072ce;color:#fff;border-color:#005a9e;}
.cp-auth label{display:block;font-size:11px;font-weight:700;color:#444;margin:10px 0 3px;}
.cp-auth input{width:100%;box-sizing:border-box;padding:9px 10px;font-size:14px;border:2px solid #9db8d2;border-radius:8px;outline:none;}
.cp-auth input:focus{border-color:#0072ce;}
.cp-auth .err{min-height:16px;margin-top:8px;font-size:11px;color:#c0392b;text-align:center;}
.cp-auth .primary{width:100%;margin-top:6px;padding:11px;font-size:14px;font-weight:700;color:#fff;background:#0072ce;border:none;border-radius:9px;cursor:pointer;}
.cp-auth .primary:hover{background:#005a9e;}
.cp-auth .primary:disabled{background:#9db8d2;cursor:default;}
.cp-auth .guest{display:block;width:100%;margin-top:10px;padding:9px;font-size:12px;color:#0072ce;background:none;border:1px dashed #0072ce;border-radius:9px;cursor:pointer;text-align:center;}
.cp-auth .guest:hover{background:#e8f2fb;}
`;

const TABS = [
    { id: 'login', label: 'Entrar' },
    { id: 'register', label: 'Criar conta' },
    { id: 'recover', label: 'Recuperar' },
];

const FIELDS = {
    login: [
        { name: 'username', label: 'Usuário', type: 'text', autocomplete: 'username' },
        { name: 'password', label: 'Senha', type: 'password', autocomplete: 'current-password' },
    ],
    register: [
        { name: 'username', label: 'Usuário (3-16)', type: 'text', autocomplete: 'username' },
        { name: 'password', label: 'Senha (6+ caracteres)', type: 'password', autocomplete: 'new-password' },
        { name: 'password2', label: 'Confirmar senha', type: 'password', autocomplete: 'new-password' },
    ],
    recover: [
        { name: 'username', label: 'Usuário', type: 'text', autocomplete: 'username' },
        { name: 'code', label: 'Código de recuperação', type: 'text', placeholder: 'XXXX-XXXX-XXXX' },
        { name: 'newPassword', label: 'Nova senha', type: 'password', autocomplete: 'new-password' },
    ],
};

export default class AuthModal {
    constructor(scene) {
        this.scene = scene;
        this.el = null;
        this.tab = 'login';
        this.inputs = {};
        this._pending = false;
    }

    get isOpen() { return !!this.el; }

    open(tab = 'login') {
        this.close();
        this.tab = tab;
        this._build();
    }

    close() {
        this.el?.remove();
        this.el = null;
        this.inputs = {};
    }

    _build() {
        if (typeof document === 'undefined') return;
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        this.el = document.createElement('div');
        this.el.className = 'cp-auth';

        const box = document.createElement('div');
        box.className = 'box';
        this.el.appendChild(box);

        const h = document.createElement('h1');
        h.textContent = 'Claude Penguin';
        box.appendChild(h);
        const sub = document.createElement('p');
        sub.className = 'sub';
        sub.textContent = 'Entre na sua conta de pinguim';
        box.appendChild(sub);

        const tabs = document.createElement('div');
        tabs.className = 'tabs';
        for (const t of TABS) {
            const b = document.createElement('button');
            b.textContent = t.label;
            b.className = t.id === this.tab ? 'on' : '';
            b.onclick = () => { this.tab = t.id; this._build(); };
            tabs.appendChild(b);
        }
        box.appendChild(tabs);

        this.inputs = {};
        for (const f of FIELDS[this.tab]) {
            const label = document.createElement('label');
            label.textContent = f.label;
            box.appendChild(label);
            const input = document.createElement('input');
            input.type = f.type;
            input.autocomplete = f.autocomplete || 'off';
            if (f.placeholder) input.placeholder = f.placeholder;
            input.dataset.field = f.name;
            box.appendChild(input);
            this.inputs[f.name] = input;
        }

        this.errEl = document.createElement('div');
        this.errEl.className = 'err';
        box.appendChild(this.errEl);

        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = { login: 'Entrar', register: 'Criar conta', recover: 'Redefinir senha' }[this.tab];
        btn.onclick = () => this._submit();
        box.appendChild(btn);
        this._btn = btn;

        const guest = document.createElement('button');
        guest.className = 'guest';
        guest.textContent = 'Jogar como visitante';
        guest.onclick = () => this.scene.network?.playAsGuest?.();
        box.appendChild(guest);

        document.body.appendChild(this.el);
        this.inputs[Object.keys(this.inputs)[0]]?.focus();
        this.el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._submit();
        });
    }

    setError(msg) {
        if (this.errEl) this.errEl.textContent = msg || '';
    }

    setLoading(on) {
        if (this._btn) {
            this._btn.disabled = !!on;
            this._btn.textContent = on ? 'Aguarde...' : { login: 'Entrar', register: 'Criar conta', recover: 'Redefinir senha' }[this.tab];
        }
    }

    _vals() {
        const out = {};
        for (const [k, el] of Object.entries(this.inputs)) out[k] = el.value;
        return out;
    }

    _submit() {
        const v = this._vals();
        this.setError('');
        const net = this.scene.network;
        if (!net) return;

        if (this.tab === 'login') {
            if (!v.username || !v.password) return this.setError('Preencha usuário e senha');
            this.setLoading(true);
            net.login(v.username.trim(), v.password);
        } else if (this.tab === 'register') {
            if (!v.username || !v.password) return this.setError('Preencha todos os campos');
            if (v.password !== v.password2) return this.setError('As senhas não conferem');
            this.setLoading(true);
            net.register(v.username.trim(), v.password);
        } else {
            if (!v.username || !v.code || !v.newPassword) return this.setError('Preencha todos os campos');
            this.setLoading(true);
            net.recover(v.username.trim(), v.code.trim(), v.newPassword);
        }
        // Timeout de segurança
        clearTimeout(this._t);
        this._t = setTimeout(() => this.setLoading(false), 10000);
    }

    // Chamado quando o servidor responde (sucesso fecha o modal)
    onServerResponse(success, message = '') {
        clearTimeout(this._t);
        this.setLoading(false);
        if (success) { this.close(); return true; }
        this.setError(message || 'Falha na operação');
        return false;
    }
}
