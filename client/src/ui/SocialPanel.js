// SocialPanel.js - janela social DOM (fase 1): buddies, ignores e pets.
// Segue o estilo visual do chat/toast DOM do projeto; dados vem de
// network.social (SOCIAL_UPDATE) e acoes via NetworkClient.

const CSS = `
.cp-social { position:fixed; z-index:99998; width:340px; max-height:480px;
  background:#f4f8ff; border:3px solid #2b6cb0; border-radius:10px;
  box-shadow:0 6px 24px rgba(0,0,0,.4); font-family:Arial,sans-serif;
  display:flex; flex-direction:column; overflow:hidden; }
.cp-social.hidden { display:none; }
.cp-social-head { display:flex; align-items:center; justify-content:space-between;
  background:linear-gradient(#4a90d9,#2b6cb0); color:#fff; padding:7px 10px;
  font-weight:700; font-size:14px; letter-spacing:.3px; }
.cp-social-head .x { cursor:pointer; font-size:16px; padding:0 4px; }
.cp-social-tabs { display:flex; background:#dbe7f5; border-bottom:1px solid #b8cfe8; }
.cp-social-tab { flex:1; text-align:center; padding:6px 0; font-size:12px; font-weight:700;
  color:#3a5a7a; cursor:pointer; border-right:1px solid #b8cfe8; }
.cp-social-tab:last-child { border-right:none; }
.cp-social-tab.on { background:#f4f8ff; color:#1a4a7a; }
.cp-social-body { overflow-y:auto; padding:8px; min-height:120px; max-height:400px; }
.cp-social-row { display:flex; align-items:center; gap:6px; padding:5px 6px;
  border-radius:6px; font-size:13px; }
.cp-social-row:hover { background:#e4eefb; }
.cp-social-row .name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cp-social-dot { width:8px; height:8px; border-radius:50%; flex:none; }
.cp-social-dot.on { background:#35c759; } .cp-social-dot.off { background:#b0b8c4; }
.cp-social-btn { font-size:11px; font-weight:700; padding:3px 8px; border-radius:5px;
  border:1px solid #2b6cb0; background:#fff; color:#2b6cb0; cursor:pointer; }
.cp-social-btn:hover { background:#e4eefb; }
.cp-social-btn.danger { border-color:#c0392b; color:#c0392b; }
.cp-social-btn.primary { background:#2b6cb0; color:#fff; }
.cp-social-btn.primary:hover { background:#1a4a7a; }
.cp-social-btn:disabled { opacity:.45; cursor:default; }
.cp-social-add { display:flex; gap:6px; margin-bottom:8px; }
.cp-social-add input { flex:1; padding:5px 8px; border:1px solid #9db8d2; border-radius:6px;
  font-size:13px; outline:none; }
.cp-social-sec { font-size:11px; font-weight:700; color:#5a7a9a; text-transform:uppercase;
  margin:8px 2px 4px; }
.cp-social-empty { color:#8aa0b8; font-size:12px; text-align:center; padding:14px 0; }
.cp-social-stat { height:6px; border-radius:3px; background:#dfe8f2; overflow:hidden; margin-top:3px; }
.cp-social-stat i { display:block; height:100%; }
`;

export default class SocialPanel {
    constructor(scene) {
        this.scene = scene;
        this.open_ = false;
        this.tab = 'buddies';
        this._build();
        scene.events.on('social-update', () => { if (this.open_) this.render(); });
        scene.events.on('buddy-request', () => { if (this.open_) this.render(); });
        scene.events.once('shutdown', () => this.destroy());
    }

    _build() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'cp-social hidden';
        this.root.innerHTML = `
            <div class="cp-social-head"><span>Clube Social</span><span class="x">✕</span></div>
            <div class="cp-social-tabs">
                <div class="cp-social-tab on" data-tab="buddies">Buddies</div>
                <div class="cp-social-tab" data-tab="ignored">Ignorados</div>
                <div class="cp-social-tab" data-tab="pets">Pets</div>
            </div>
            <div class="cp-social-body"></div>`;
        document.body.appendChild(this.root);
        this.body = this.root.querySelector('.cp-social-body');
        this.root.querySelector('.x').onclick = () => this.close();
        this.root.querySelectorAll('.cp-social-tab').forEach((t) => {
            t.onclick = () => { this.tab = t.dataset.tab; this._markTab(); this.render(); };
        });
    }

    _markTab() {
        this.root.querySelectorAll('.cp-social-tab').forEach((t) => {
            t.classList.toggle('on', t.dataset.tab === this.tab);
        });
    }

    toggle() { this.open_ ? this.close() : this.open(); }
    open() {
        this.open_ = true;
        this.root.classList.remove('hidden');
        // posicao: canto inferior esquerdo, acima do HUD
        this.root.style.left = '10px';
        this.root.style.bottom = '70px';
        this.scene.network?.getSocial();
        this.render();
    }
    close() { this.open_ = false; this.root.classList.add('hidden'); }
    destroy() { this.root?.remove(); }

    render() {
        if (!this.open_) return;
        const s = this.scene.network?.social || {};
        if (this.tab === 'buddies') this._renderBuddies(s);
        else if (this.tab === 'ignored') this._renderIgnored(s);
        else this._renderPets(s);
    }

    _row(html) {
        const d = document.createElement('div');
        d.className = 'cp-social-row';
        d.innerHTML = html;
        return d;
    }
    _btn(label, cls, fn) {
        const b = document.createElement('button');
        b.className = 'cp-social-btn ' + cls;
        b.textContent = label;
        b.onclick = (e) => { e.stopPropagation(); fn(); };
        return b;
    }
    _empty(msg) {
        const d = document.createElement('div');
        d.className = 'cp-social-empty';
        d.textContent = msg;
        return d;
    }

    // ---------- BUDDIES ----------
    _renderBuddies(s) {
        const net = this.scene.network;
        this.body.innerHTML = '';
        // pedidos recebidos
        const received = (s.requests || []).filter((r) => r.direction === 'received');
        const sent = (s.requests || []).filter((r) => r.direction === 'sent');
        if (received.length) {
            this.body.appendChild(this._sec('Pedidos recebidos'));
            for (const r of received) {
                const row = this._row(`<span class="name">${esc(r.username)}</span>`);
                row.appendChild(this._btn('Aceitar', 'primary', () => net.buddyAccept(r.playerId)));
                row.appendChild(this._btn('Recusar', 'danger', () => net.buddyDecline(r.playerId)));
                this.body.appendChild(row);
            }
        }
        if (sent.length) {
            this.body.appendChild(this._sec('Pedidos enviados'));
            for (const r of sent) {
                const row = this._row(`<span class="name">${esc(r.username)}</span><span style="font-size:11px;color:#8aa0b8">aguardando…</span>`);
                row.appendChild(this._btn('Cancelar', '', () => net.buddyCancel(r.playerId)));
                this.body.appendChild(row);
            }
        }
        // adicionar
        const add = document.createElement('div');
        add.className = 'cp-social-add';
        add.innerHTML = `<input type="text" maxlength="20" placeholder="Adicionar buddy por nome…"><button class="cp-social-btn primary">+</button>`;
        const inp = add.querySelector('input');
        const go = () => { const v = inp.value.trim(); if (v) net.buddyAdd(v); inp.value = ''; };
        add.querySelector('button').onclick = go;
        inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
        this.body.appendChild(add);
        // lista
        this.body.appendChild(this._sec(`Meus buddies (${(s.buddies || []).length})`));
        if (!(s.buddies || []).length) this.body.appendChild(this._empty('Nenhum buddy ainda.'));
        for (const b of s.buddies || []) {
            const row = this._row(
                `<span class="cp-social-dot ${b.online ? 'on' : 'off'}"></span>` +
                `<span class="name">${esc(b.username)}</span>` +
                `<span style="font-size:10px;color:#8aa0b8">${b.online ? 'online' : 'offline'}</span>`
            );
            row.appendChild(this._btn('Remover', 'danger', () => net.buddyRemove(b.playerId)));
            this.body.appendChild(row);
        }
    }

    // ---------- IGNORED ----------
    _renderIgnored(s) {
        this.body.innerHTML = '';
        this.body.appendChild(this._sec(`Jogadores ignorados (${(s.ignores || []).length})`));
        if (!(s.ignores || []).length) this.body.appendChild(this._empty('Ninguém ignorado.'));
        for (const i of s.ignores || []) {
            const row = this._row(`<span class="name">${esc(i.username)}</span>`);
            row.appendChild(this._btn('Deixar de ignorar', '', () => this.scene.network.ignoreRemove(i.playerId)));
            this.body.appendChild(row);
        }
    }

    // ---------- PETS ----------
    _renderPets(s) {
        const net = this.scene.network;
        const coins = net.coins ?? 0;
        this.body.innerHTML = '';
        // pets do jogador
        this.body.appendChild(this._sec(`Meus pets (${(s.pets || []).length})`));
        if (!(s.pets || []).length) this.body.appendChild(this._empty('Você ainda não tem pets. Adote um abaixo!'));
        for (const p of s.pets || []) {
            const card = document.createElement('div');
            card.style.cssText = 'border:1px solid #b8cfe8;border-radius:8px;padding:8px;margin-bottom:8px;background:#fff;';
            const sp = (s.petSpecies || []).find((x) => x.id === p.species);
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px">
                    <span>${esc(p.name)}</span><span style="color:#8aa0b8;font-weight:400">${esc(sp?.name || p.species)}</span>
                </div>
                <div style="font-size:11px;color:#5a7a9a;margin-top:2px">Fome</div>
                <div class="cp-social-stat"><i style="width:${p.hunger}%;background:#e8a13c"></i></div>
                <div style="font-size:11px;color:#5a7a9a;margin-top:4px">Felicidade</div>
                <div class="cp-social-stat"><i style="width:${p.happiness}%;background:#35c759"></i></div>
                <div style="display:flex;gap:6px;margin-top:7px"></div>`;
            const acts = card.querySelector('div:last-child');
            acts.appendChild(this._btn('Alimentar', '', () => net.petCare(p.petRowId, 'feed')));
            acts.appendChild(this._btn('Brincar', '', () => net.petCare(p.petRowId, 'play')));
            acts.appendChild(this._btn('Soltar', 'danger', () => {
                if (confirm(`Soltar ${p.name}? Essa ação não pode ser desfeita.`)) net.petRelease(p.petRowId);
            }));
            this.body.appendChild(card);
        }
        // adocao
        this.body.appendChild(this._sec(`Adotar pet — ${coins} coins`));
        for (const sp of s.petSpecies || []) {
            const row = this._row(
                `<span class="name">${esc(sp.name)}</span>` +
                `<span style="font-size:11px;color:#8aa0b8">${sp.cost}c</span>`
            );
            const b = this._btn('Adotar', 'primary', () => {
                const name = prompt(`Nome para o ${sp.name}:`, sp.name);
                if (name !== null) net.petAdopt(sp.id, name || sp.name);
            });
            if (coins < sp.cost) b.disabled = true;
            row.appendChild(b);
            this.body.appendChild(row);
        }
    }

    _sec(text) {
        const d = document.createElement('div');
        d.className = 'cp-social-sec';
        d.textContent = text;
        return d;
    }
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
